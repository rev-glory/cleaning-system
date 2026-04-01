import torch
import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

_shared_model = YOLO("yolov8n-seg.pt")

def pil_to_cv2(image: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

def cv2_to_pil(image: np.ndarray) -> Image.Image:
    return Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

def remove_humans(image: Image.Image) -> tuple[Image.Image, bool]:
    cv_image = pil_to_cv2(image)
    humans_detected = False
    try:
        results = _privacy_model(cv_image, classes=[0], verbose=False)
        for result in results:
            for box in result.boxes:
                humans_detected = True
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                roi = cv_image[y1:y2, x1:x2]
                blurred = cv2.GaussianBlur(roi, (99, 99), 30)
                cv_image[y1:y2, x1:x2] = blurred
    except Exception as e:
        print(f"Privacy processing warning: {e}")
    return cv2_to_pil(cv_image), humans_detected

def scrub_faces(image: Image.Image) -> Image.Image:
    cv_image = pil_to_cv2(image)
    try:
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        for (x, y, w, h) in faces:
            roi = cv_image[y:y+h, x:x+w]
            if roi.size > 0:
                blurred = cv2.GaussianBlur(roi, (99, 99), 30)
                cv_image[y:y+h, x:x+w] = blurred
    except Exception as e:
        print(f"Face scrub warning: {e}")
    return cv2_to_pil(cv_image)