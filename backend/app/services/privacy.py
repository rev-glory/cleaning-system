import cv2
import numpy as np
from app.services.models import shared_model

def remove_humans(cv_image: np.ndarray) -> tuple[np.ndarray, bool]:
    humans_detected = False
    try:
        results = shared_model(cv_image, classes=[0], verbose=False)
        for result in results:
            for box in result.boxes:
                humans_detected = True
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                roi = cv_image[y1:y2, x1:x2]
                if roi.size > 0:
                    blurred = cv2.GaussianBlur(roi, (99, 99), 30)
                    cv_image[y1:y2, x1:x2] = blurred
    except Exception as e:
        print(f"Privacy processing warning: {e}")
    return cv_image, humans_detected

def scrub_faces(cv_image: np.ndarray) -> np.ndarray:
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
    return cv_image