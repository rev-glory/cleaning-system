from PIL import Image
import numpy as np
import cv2
import io

# Trash/waste class labels from COCO + common waste
WASTE_CLASSES = {
    "bottle", "cup", "wine glass", "fork", "knife", "spoon",
    "bowl", "banana", "apple", "sandwich", "orange", "broccoli",
    "carrot", "hot dog", "pizza", "donut", "cake", "chair",
    "potted plant", "trash", "garbage", "litter", "waste",
    "plastic bag", "paper", "cardboard", "can", "wrapper"
}

def run_detection(image: Image.Image) -> list[dict]:
    detections = []
    try:
        from ultralytics import YOLO
        model = YOLO("yolov8n.pt")
        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        results = model(cv_image, verbose=False)

        for result in results:
            for box in result.boxes:
                label = result.names[int(box.cls[0])]
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])

                # Only keep non-person detections
                if label != "person" and confidence > 0.4:
                    detections.append({
                        "label": label,
                        "confidence": round(confidence, 3),
                        "bbox": [x1, y1, x2 - x1, y2 - y1]
                    })
    except Exception as e:
        print(f"Detection warning: {e}")

    return detections


def draw_zone_map(image: Image.Image, detections: list[dict]) -> Image.Image:
    cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    for det in detections:
        x, y, w, h = det["bbox"]
        label = det["label"]
        conf = det["confidence"]

        # Color based on confidence
        if conf > 0.75:
            color = (0, 0, 220)    # red — high confidence
        elif conf > 0.55:
            color = (0, 140, 255)  # orange — medium
        else:
            color = (0, 220, 220)  # yellow — low

        cv2.rectangle(cv_image, (x, y), (x + w, y + h), color, 2)
        cv2.putText(
            cv_image, f"{label} {conf:.0%}",
            (x, max(y - 8, 0)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1
        )

    return Image.fromarray(cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB))