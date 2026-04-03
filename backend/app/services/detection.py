import numpy as np
import cv2
from sklearn.cluster import DBSCAN
from app.services.models import shared_model

IGNORE_CLASSES = {
    "person", "chair", "couch", "bed", "dining table",
    "toilet", "tv", "laptop", "keyboard", "mouse",
    "refrigerator", "oven", "microwave", "sink", "toaster",
    "potted plant", "clock", "door", "window", "wall",
    "ceiling", "floor", "building", "sky", "tree", "road",
    "bicycle", "car", "motorcycle", "airplane", "bus",
    "train", "truck", "boat", "traffic light", "stop sign"
}

LITTER_CLASSES = {
    "bottle", "wine glass", "cup", "fork", "knife", "spoon",
    "bowl", "banana", "apple", "sandwich", "orange", "broccoli",
    "carrot", "hot dog", "pizza", "donut", "cake", "backpack",
    "umbrella", "handbag", "suitcase", "book", "vase",
    "scissors", "cell phone", "remote", "teddy bear",
    "toothbrush", "hair drier", "tie"
}

FLOOR_ZONE_RATIO = 0.55

def analyze_floor_mess(cv_image: np.ndarray, valid_floor_mask: np.ndarray) -> list[dict]:
    results = []
    try:
        img_h, img_w = cv_image.shape[:2]
        floor_start = int(img_h * FLOOR_ZONE_RATIO)
        
        floor_img = cv_image[floor_start:, :]
        local_mask = valid_floor_mask[floor_start:, :]
        
        floor_area = cv2.countNonZero(local_mask)
        if floor_area < 100:  
            return results

        floor_gray = cv2.cvtColor(floor_img, cv2.COLOR_BGR2GRAY)
        floor_hsv = cv2.cvtColor(floor_img, cv2.COLOR_BGR2HSV)

        edges = cv2.Canny(floor_gray, 40, 120)
        edges_masked = cv2.bitwise_and(edges, edges, mask=local_mask)
        edge_density = np.sum(edges_masked > 0) / floor_area

        if edge_density > 0.15:
            results.append({
                "label": "floor_clutter", "confidence": round(min(edge_density * 4, 0.92), 3),
                "bbox": [0, floor_start, img_w, img_h - floor_start],
                "area_ratio": round(edge_density, 4), "is_litter": True, "weight": 2.0
            })
        elif edge_density > 0.10:
            results.append({
                "label": "floor_clutter", "confidence": round(edge_density * 3, 3),
                "bbox": [0, floor_start, img_w, img_h - floor_start],
                "area_ratio": round(edge_density, 4), "is_litter": True, "weight": 1.2
            })

        sat = floor_hsv[:, :, 1]
        valid_sat = sat[local_mask > 0]
        sat_std = np.std(valid_sat) if len(valid_sat) > 0 else 0

        if sat_std > 55:
            results.append({
                "label": "color_irregularity", "confidence": round(min(sat_std / 80, 0.88), 3),
                "bbox": [0, floor_start, img_w, img_h - floor_start],
                "area_ratio": 0.2, "is_litter": True, "weight": 1.5
            })

        spill_mask = cv2.bitwise_and(
            cv2.threshold(sat, 75, 255, cv2.THRESH_BINARY)[1],
            cv2.threshold(floor_hsv[:, :, 2], 35, 255, cv2.THRESH_BINARY)[1]
        )
        spill_mask = cv2.bitwise_and(spill_mask, spill_mask, mask=local_mask)
        spill_mask = cv2.morphologyEx(spill_mask, cv2.MORPH_OPEN, np.ones((12, 12), np.uint8))
        
        spill_contours, _ = cv2.findContours(spill_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in spill_contours:
            area = cv2.contourArea(cnt)
            area_ratio = area / floor_area
            if area_ratio < 0.015: continue
            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0: continue
            circularity = 4 * np.pi * area / (perimeter * perimeter)
            if circularity < 0.5:
                x, y, w, h = cv2.boundingRect(cnt)
                results.append({
                    "label": "liquid_spill", "confidence": round(min(0.5 + area_ratio * 3, 0.90), 3),
                    "bbox": [x, floor_start + y, w, h], "area_ratio": round(area_ratio, 4),
                    "is_litter": True, "weight": 2.0
                })
    except Exception as e:
        print(f"Floor analysis warning: {e}")
    return results

def run_detection(cv_image: np.ndarray) -> list[dict]:
    detections = []
    try:
        img_h, img_w = cv_image.shape[:2]
        img_area = img_h * img_w
        
        results = shared_model(cv_image, verbose=False)
        valid_floor_mask = np.ones((img_h, img_w), dtype=np.uint8) * 255
        litter_points = []
        litter_items = []

        for result in results:
            if not result.masks: continue
            boxes = result.boxes
            polygons = result.masks.xy 

            for i, box in enumerate(boxes):
                label = result.names[int(box.cls[0])]
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])

                if confidence < 0.35: continue

                polygon = np.array(polygons[i], dtype=np.int32)

                if label in IGNORE_CLASSES:
                    cv2.fillPoly(valid_floor_mask, [polygon], 0)
                    continue

                if label in LITTER_CLASSES:
                    mask_area = cv2.contourArea(polygon)
                    area_ratio = mask_area / img_area
                    
                    M = cv2.moments(polygon)
                    if M["m00"] != 0:
                        cx, cy = int(M["m10"] / M["m00"]), int(M["m01"] / M["m00"])
                    else:
                        cx, cy = int((x1+x2)/2), int((y1+y2)/2)

                    on_floor = cy > img_h * FLOOR_ZONE_RATIO
                    weight = (1.8 if on_floor else 0.5)

                    litter_points.append([cx, cy])
                    litter_items.append({
                        "label": label if on_floor else f"{label} (shelf)", "confidence": round(confidence, 3),
                        "bbox": [x1, y1, x2 - x1, y2 - y1], "polygon": polygon.tolist(),
                        "area_ratio": round(area_ratio, 4), "is_litter": on_floor, "weight": weight, "on_floor": on_floor
                    })

        if len(litter_points) > 0:
            clustering = DBSCAN(eps=60, min_samples=3).fit(litter_points)
            labels = clustering.labels_
            clusters = {}
            for idx, cluster_id in enumerate(labels):
                item = litter_items[idx]
                if cluster_id == -1:
                    detections.append(item)
                else:
                    if cluster_id not in clusters: clusters[cluster_id] = []
                    clusters[cluster_id].append(item)
                    
            for cid, items in clusters.items():
                min_x = min([it["bbox"][0] for it in items])
                min_y = min([it["bbox"][1] for it in items])
                max_x = max([it["bbox"][0] + it["bbox"][2] for it in items])
                max_y = max([it["bbox"][1] + it["bbox"][3] for it in items])
                avg_conf = sum([it["confidence"] for it in items]) / len(items)
                total_area = sum([it["area_ratio"] for it in items])
                
                detections.append({
                    "label": "trash_cluster", "confidence": round(min(avg_conf * 1.5, 0.95), 3),
                    "bbox": [min_x, min_y, max_x - min_x, max_y - min_y], "area_ratio": total_area,
                    "is_litter": True, "weight": 3.5, "on_floor": True
                })

        detections.extend(analyze_floor_mess(cv_image, valid_floor_mask))

    except Exception as e:
        import traceback
        traceback.print_exc()
        
    return detections

def draw_zone_map(cv_image: np.ndarray, detections: list[dict]) -> np.ndarray:
    img_h, img_w = cv_image.shape[:2]
    floor_start = int(img_h * FLOOR_ZONE_RATIO)
    cv2.line(cv_image, (0, floor_start), (img_w, floor_start), (0, 255, 0), 1)
    cv2.putText(cv_image, "floor zone", (5, floor_start - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)

    label_colors = {
        "liquid_spill": (0, 165, 255), "floor_clutter": (180, 50, 255),
        "color_irregularity": (255, 100, 0), "trash_cluster": (0, 0, 255)
    }

    for det in detections:
        x, y, w, h = det["bbox"]
        label = det["label"]
        conf = det["confidence"]
        is_litter = det.get("is_litter", False)
        on_floor = det.get("on_floor", True)

        color = label_colors.get(label, ((0, 0, 220) if (is_litter and on_floor) else (180, 180, 180)))

        if "polygon" in det and det["polygon"]:
            poly = np.array(det["polygon"], dtype=np.int32)
            overlay = cv_image.copy()
            cv2.fillPoly(overlay, [poly], color)
            cv2.addWeighted(overlay, 0.4, cv_image, 0.6, 0, cv_image)
            cv2.polylines(cv_image, [poly], True, color, 2)
        else:
            overlay = cv_image.copy()
            cv2.rectangle(overlay, (x, y), (x + w, y + h), color, -1)
            cv2.addWeighted(overlay, 0.15, cv_image, 0.85, 0, cv_image)
            cv2.rectangle(cv_image, (x, y), (x + w, y + h), color, 2)

        cv2.putText(cv_image, f"{label} {conf:.0%}", (x, max(y - 5, 0)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)

    return cv_image