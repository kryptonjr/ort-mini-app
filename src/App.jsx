import { useState, useEffect } from 'react';
import './App.css';

// Инициализируем объект Telegram
const tg = window.Telegram.WebApp;

function App() {
  const [currentScreen, setCurrentScreen] = useState('main');
  const [userData, setUserData] = useState(null);

  // Когда приложение запускается, вытягиваем данные пользователя из телеги
  useEffect(() => {
    tg.ready(); // Сообщаем телеграму, что приложение готово
    tg.expand(); // Открываем на весь экран

    // Если мы открыли внутри Telegram, берем реальные данные. Если в браузере - тестовые.
    const user = tg.initDataUnsafe?.user;
    if (user) {
      setUserData({
        first_name: user.first_name,
        id: user.id,
      });
    } else {
      setUserData({
        first_name: "Разработчик",
        id: "123456789",
      });
    }
  }, []);

  // Функция для отправки выбранного предмета в Python-бота
  const handleStartTraining = (subjectName) => {
    // Отправляем название предмета (например, 'Алгебра') в Telegram
    tg.sendData(subjectName);
    // Закрываем Mini App
    tg.close();
  };

  // === ЭКРАН: ПРОФИЛЬ ===
  if (currentScreen === 'profile') {
    return (
      <div className="screen-container">
        <h2 className="title">👤 Мой профиль</h2>
        <div className="profile-info-block" style={{marginBottom: '20px', textAlign: 'center'}}>
           <p>Имя: <b>{userData?.first_name}</b></p>
           <p>Твой ID: <code>{userData?.id}</code></p>
           {/* Кнопки языка и VIP добавим сюда чуть позже */}
        </div>
        <button className="back-button" onClick={() => setCurrentScreen('main')}>⬅ Назад в меню</button>
      </div>
    );
  }

  // === ЭКРАН: ТРЕНИРОВКА ===
  if (currentScreen === 'training') {
    return (
      <div className="screen-container">
        <h2 className="title">📚 Выбор предмета</h2>
        <div className="subjects-grid">
          {/* Названия должны СТРОГО совпадать с тем, что ждет Python */}
          <button className="subject-card" onClick={() => handleStartTraining('Алгебра')}>
            <span className="subject-icon">🔢</span>
            <span className="subject-name">Алгебра</span>
          </button>
          <button className="subject-card" onClick={() => handleStartTraining('Геометрия')}>
            <span className="subject-icon">📐</span>
            <span className="subject-name">Геометрия</span>
          </button>
          <button className="subject-card" onClick={() => handleStartTraining('Аналогии')}>
            <span className="subject-icon">🧩</span>
            <span className="subject-name">Аналогии</span>
          </button>
          <button className="subject-card" onClick={() => handleStartTraining('Дополнение предложений')}>
            <span className="subject-icon">📝</span>
            <span className="subject-name">Дополнение предложений</span>
          </button>
          <button className="subject-card" onClick={() => handleStartTraining('Чтение и понимание')}>
            <span className="subject-icon">📖</span>
            <span className="subject-name">Чтение и понимание</span>
          </button>
          <button className="subject-card" onClick={() => handleStartTraining('Грамматика')}>
            <span className="subject-icon">✍️</span>
            <span className="subject-name">Грамматика</span>
          </button>
        </div>
        <button className="back-button" onClick={() => setCurrentScreen('main')}>⬅ Назад в меню</button>
      </div>
    );
  }

  // === ГЛАВНЫЙ ЭКРАН ===
  return (
    <div className="app-container">
      <div className="header">
        <h1>🧬 O.R.T. AI</h1>
        <div className="profile-card">
          <p>Привет, {userData?.first_name}! 👋</p>
        </div>
      </div>

      <div className="buttons-column">
        <button className="primary-btn" onClick={() => setCurrentScreen('training')}>
          📚 Начать тренировку
        </button>
        <button className="secondary-btn" onClick={() => setCurrentScreen('profile')}>
          👤 Мой профиль
        </button>
        <button className="danger-btn" onClick={() => tg.close()}>Закрыть приложение</button>
      </div>
    </div>
  );
}

export default App;