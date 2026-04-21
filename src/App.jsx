import { useState, useEffect } from 'react';
import './App.css';

const tg = window.Telegram.WebApp;
// ТВОЯ НОВАЯ ССЫЛКА ДЛЯ API
const API_URL = "https://ort-bot.ru";

function App() {
  const [currentScreen, setCurrentScreen] = useState('main');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe?.user;
    const userId = user?.id || 1014543443; // Твой ID для теста, если открыто в браузере

    // ЗАПРОС К БОТУ ЗА РЕАЛЬНЫМИ ДАННЫМИ
    fetch(`${API_URL}/get_user_data?user_id=${userId}`)
      .then(res => res.json())
      .then(data => {
        setUserData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Ошибка загрузки данных:", err);
        setLoading(false);
      });
  }, []);

  const handleStartTraining = (subjectName) => {
    tg.sendData(subjectName);
    tg.close();
  };

  if (loading) {
    return <div className="loading">Загрузка данных из БД...</div>;
  }

  // === ЭКРАН: ПРОФИЛЬ (Теперь с реальными данными!) ===
  if (currentScreen === 'profile') {
    return (
      <div className="screen-container">
        <h2 className="title">👤 Мой профиль</h2>
        <div className="profile-card-real">
           <p>Имя: <b>{userData?.first_name}</b></p>
           <p>Статус: <span className="role-tag">{userData?.role}</span></p>
           <div className="stats-grid">
              <div className="stat-item">
                <span>Алгебра</span>
                <b>{userData?.scores?.algebra}</b>
              </div>
              <div className="stat-item">
                <span>Геометрия</span>
                <b>{userData?.scores?.geometry}</b>
              </div>
              <div className="stat-item">
                <span>Грамматика</span>
                <b>{userData?.scores?.grammar}</b>
              </div>
           </div>
           <p style={{marginTop: '15px'}}>Решено задач: {userData?.solved_tasks}</p>
        </div>
        <button className="back-button" onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
      </div>
    );
  }

  // === ЭКРАН: ТРЕНИРОВКА ===
  if (currentScreen === 'training') {
    return (
      <div className="screen-container">
        <h2 className="title">📚 Предметы</h2>
        <div className="subjects-grid">
          {['Алгебра', 'Геометрия', 'Аналогии', 'Дополнение предложений', 'Чтение и понимание', 'Грамматика'].map(subject => (
            <button key={subject} className="subject-card" onClick={() => handleStartTraining(subject)}>
              <span className="subject-name">{subject}</span>
            </button>
          ))}
        </div>
        <button className="back-button" onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
      </div>
    );
  }

  // === ГЛАВНЫЙ ЭКРАН ===
  return (
    <div className="app-container">
      <div className="header">
        <h1>🧬 O.R.T. AI</h1>
        <p>Привет, {userData?.first_name}!</p>
      </div>
      <div className="buttons-column">
        <button className="primary-btn" onClick={() => setCurrentScreen('training')}>📚 Тренировка</button>
        <button className="secondary-btn" onClick={() => setCurrentScreen('profile')}>👤 Профиль</button>
        <button className="danger-btn" onClick={() => tg.close()}>Выход</button>
      </div>
    </div>
  );
}

export default App;