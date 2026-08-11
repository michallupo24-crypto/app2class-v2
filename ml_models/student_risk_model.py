import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
import matplotlib.pyplot as plt
import os

def generate_student_data(n_students=1000):
    """
    יוצרת נתוני תלמידים סינתטיים לאימון הרשת.
    """
    np.random.seed(42)
    
    data = []
    
    for i in range(n_students):
        # תלמיד חזק
        if np.random.random() < 0.4:
            student = {
                'avg_score': np.random.normal(85, 8),
                'score_trend': np.random.normal(2, 3),
                'absence_rate': np.random.beta(1, 10),
                'task_completion': np.random.beta(8, 2),
                'avg_task_time': np.random.normal(30, 10),
                'error_pattern': np.random.beta(2, 8),
                'days_since_login': np.random.exponential(1),
                'homework_rate': np.random.beta(8, 2),
                'at_risk': 0  # לא בסיכון
            }
        # תלמיד בסיכון
        elif np.random.random() < 0.5:
            student = {
                'avg_score': np.random.normal(65, 12),
                'score_trend': np.random.normal(-8, 5),
                'absence_rate': np.random.beta(3, 7),
                'task_completion': np.random.beta(3, 7),
                'avg_task_time': np.random.normal(70, 20),
                'error_pattern': np.random.beta(7, 3),
                'days_since_login': np.random.exponential(5),
                'homework_rate': np.random.beta(3, 7),
                'at_risk': 1  # בסיכון
            }
        # תלמיד בינוני
        else:
            student = {
                'avg_score': np.random.normal(75, 10),
                'score_trend': np.random.normal(0, 4),
                'absence_rate': np.random.beta(2, 8),
                'task_completion': np.random.beta(6, 4),
                'avg_task_time': np.random.normal(45, 15),
                'error_pattern': np.random.beta(4, 6),
                'days_since_login': np.random.exponential(2),
                'homework_rate': np.random.beta(6, 4),
                'at_risk': 0
            }
        
        data.append(student)
    
    df = pd.DataFrame(data)
    
    # נרמול ציונים לטווח 0-100
    df['avg_score'] = df['avg_score'].clip(0, 100)
    
    return df

def predict_student_risk(student_data: dict, model, scaler) -> dict:
    """
    מקבלת נתוני תלמיד ומחזירה הערכת סיכון.
    """
    # המרה לוקטור
    features = np.array([[
        student_data['avg_score'],
        student_data['score_trend'],
        student_data['absence_rate'],
        student_data['task_completion'],
        student_data['avg_task_time'],
        student_data['error_pattern'],
        student_data['days_since_login'],
        student_data['homework_rate']
    ]])
    
    # נרמול
    features_scaled = scaler.transform(features)
    
    # ניבוי
    risk_probability = model.predict(features_scaled)[0][0]
    
    # פרשנות
    if risk_probability > 0.7:
        risk_level = "גבוה"
        recommendation = "יש ליצור קשר עם התלמיד בהקדם"
        alert_teacher = True
    elif risk_probability > 0.4:
        risk_level = "בינוני"
        recommendation = "מומלץ לעקוב מקרוב"
        alert_teacher = False
    else:
        risk_level = "נמוך"
        recommendation = "התלמיד על המסלול הנכון"
        alert_teacher = False
    
    return {
        'risk_probability': float(risk_probability),
        'risk_level': risk_level,
        'recommendation': recommendation,
        'alert_teacher': alert_teacher
    }

if __name__ == "__main__":
    print("מתחיל ביצירת הנתונים הסינתטיים...")
    df = generate_student_data(2000)
    print(df.head())
    print(f"\nאחוז תלמידים בסיכון: {df['at_risk'].mean():.1%}")

    # הכנת הנתונים
    feature_columns = [
        'avg_score', 'score_trend', 'absence_rate', 
        'task_completion', 'avg_task_time', 'error_pattern',
        'days_since_login', 'homework_rate'
    ]

    X = df[feature_columns].values
    y = df['at_risk'].values

    # חלוקה לאימון ובדיקה
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # נרמול הנתונים (חשוב מאוד!)
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    # בניית הרשת
    print("\nבונה את מודל רשת הנוירונים...")
    model = keras.Sequential([
        # שכבת קלט - 8 features
        keras.layers.Dense(64, activation='relu', input_shape=(8,)),
        keras.layers.Dropout(0.3),  # מונע overfitting
        
        # שכבה נסתרת
        keras.layers.Dense(32, activation='relu'),
        keras.layers.Dropout(0.2),
        
        # שכבה נסתרת שניה
        keras.layers.Dense(16, activation='relu'),
        
        # שכבת פלט - הסתברות לסיכון
        keras.layers.Dense(1, activation='sigmoid')
    ])

    model.compile(
        optimizer='adam',
        loss='binary_crossentropy',
        metrics=['accuracy', 'AUC']
    )

    model.summary()

    # אימון
    print("\nמתחיל באימון המודל (Epochs)...")
    history = model.fit(
        X_train, y_train,
        epochs=50,
        batch_size=32,
        validation_split=0.2,
        verbose=1
    )

    # הערכת ביצועים
    print("\nמעריך ביצועים על נתוני הבדיקה (Test Data)...")
    test_loss, test_accuracy, test_auc = model.evaluate(X_test, y_test)
    print(f"\nדיוק על נתוני בדיקה: {test_accuracy:.1%}")
    print(f"AUC: {test_auc:.3f}")

    # שמירה
    model_dir = 'saved_models'
    os.makedirs(model_dir, exist_ok=True)
    
    model_path = os.path.join(model_dir, 'student_risk_model.h5')
    scaler_path = os.path.join(model_dir, 'scaler.pkl')

    model.save(model_path)
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
        
    print(f"\nהמודל וה-Scaler נשמרו בהצלחה בתיקיית: {model_dir}")

    # דוגמה לשימוש
    print("\n--- בדיקת המודל על תלמיד לדוגמה ---")
    example_student = {
        'avg_score': 62,
        'score_trend': -10,
        'absence_rate': 0.25,
        'task_completion': 0.5,
        'avg_task_time': 80,
        'error_pattern': 0.7,
        'days_since_login': 5,
        'homework_rate': 0.4
    }

    result = predict_student_risk(example_student, model, scaler)
    print(f"נתוני התלמיד: {example_student}")
    print(f"רמת סיכון: {result['risk_level']}")
    print(f"הסתברות: {result['risk_probability']:.1%}")
    print(f"המלצה: {result['recommendation']}")

    # גרף אימון - שמירה לתמונה
    print("\nיוצר גרף תוצאות ושומר ל-training_results.png...")
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))

    axes[0].plot(history.history['accuracy'], label='אימון')
    axes[0].plot(history.history['val_accuracy'], label='ולידציה')
    axes[0].set_title('דיוק לאורך האימון')
    axes[0].legend()

    axes[1].plot(history.history['loss'], label='אימון')
    axes[1].plot(history.history['val_loss'], label='ולידציה')
    axes[1].set_title('שגיאה לאורך האימון')
    axes[1].legend()

    plt.tight_layout()
    plt.savefig('training_results.png')
    print("הגרף נשמר כ-training_results.png. סיום התוכנית.")
