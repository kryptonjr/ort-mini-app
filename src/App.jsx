import { useState, useEffect } from 'react';
import './App.css';

const tg = window.Telegram.WebApp;
const API_URL = "https://ort-bot.ru";

function App() {
  const [currentScreen, setCurrentScreen] = useState('main');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Состояния для теста
  const [selectedSubject, setSelectedSubject] = useState('');
  const [tasks, setTasks] = useState([]);
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
  const [answerInput, setAnswerInput] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [solvedIds, setSolvedIds] = useState([]);

  // ID пользователя
  const userId = tg.initDataUnsafe?.user?.id || 1014543443;

  // --- Загрузка профиля при старте ---
  useEffect(() => {
    tg.ready();
    tg.expand();

    fetch(`${API_URL}/get_user_data?user_id=${userId}`)
      .then(res => res.json())
      .then(data => {
        setUserData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Ошибка:", err);
        setLoading(false);
      });
  }, []);

  // --- 1. Клик по предмету ---
  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    setCurrentScreen('amount_select');
  };


  // --- 2. Скачиваем задачи с сервера (Исправленная версия) ---
  const handleStartTest = (amount) => {
    setLoading(true);

    // Кодируем предмет (чтобы Алгебра не превратилась в кракозябры)
    const encodedSubject = encodeURIComponent(selectedSubject);
    const url = `${API_URL}/get_tasks?user_id=${userId}&subject=${encodedSubject}&amount=${amount}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          alert("Задач по этому предмету пока нет или ты всё решил!");
          setLoading(false);
          setCurrentScreen('training');
          return;
        }
        setTasks(data);
        setCurrentTaskIdx(0);
        setCorrectCount(0);
        setSolvedIds([]);
        setCurrentScreen('solving');
        setLoading(false);
      })
      .catch(err => {
        console.error("Критическая ошибка загрузки:", err);
        alert("Не удалось загрузить задачи. Проверь консоль сервера.");
        setLoading(false); // Выключаем загрузку, чтобы экран не висел
        setCurrentScreen('training');
      });
  };

  // --- 3. Обработка ответа юзера ---
  const handleNextTask = () => {
    const currentTask = tasks[currentTaskIdx];
    let isCorrect = false;

    // Сравниваем ответ (без учета регистра и пробелов)
    if (answerInput.trim().toLowerCase() === String(currentTask.correct_answer).trim().toLowerCase()) {
      setCorrectCount(prev => prev + 1);
      isCorrect = true;
    }

    // Записываем ID задачи
    const newSolvedIds = [...solvedIds, currentTask.id];
    setSolvedIds(newSolvedIds);

    // Очищаем поле ввода
    setAnswerInput('');

    // Идем дальше или заканчиваем тест
    if (currentTaskIdx + 1 < tasks.length) {
      setCurrentTaskIdx(prev => prev + 1);
    } else {
      finishTest(isCorrect ? correctCount + 1 : correctCount, newSolvedIds);
    }
  };

  // --- 4. Финиш теста и отправка данных в БД ---
  const finishTest = (finalScore, finalIds) => {
    setCurrentScreen('result');
    // Отправляем результаты на сервер
    fetch(`${API_URL}/save_result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        subject: selectedSubject,
        correct_count: finalScore,
        solved_ids: finalIds
      })
    });
  };


  if (loading) return <div className="loading">Загрузка данных...</div>;

  // === ЭКРАН: ГЛАВНЫЙ ===
  if (currentScreen === 'main') {
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

  // === ЭКРАН: ПРОФИЛЬ ===
  if (currentScreen === 'profile') {
    return (
      <div className="screen-container">
        <h2 className="title">👤 Мой профиль</h2>
        <div className="profile-card-real">
           <p>Имя: <b>{userData?.first_name}</b></p>
           <p>Статус: <span className="role-tag">{userData?.role}</span></p>
           <div className="stats-grid">
              <div className="stat-item"><span>Алгебра</span><b>{userData?.scores?.algebra}</b></div>
              <div className="stat-item"><span>Геометрия</span><b>{userData?.scores?.geometry}</b></div>
           </div>
           <p style={{marginTop: '15px'}}>Решено задач: {userData?.solved_tasks}</p>
        </div>
        <button className="back-button" onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
      </div>
    );
  }

  // === ЭКРАН: ТРЕНИРОВКА (ВЫБОР ПРЕДМЕТА) ===
  if (currentScreen === 'training') {
    return (
      <div className="screen-container">
        <h2 className="title">📚 Предметы</h2>
        <div className="subjects-grid">
          {['Алгебра', 'Геометрия'].map(subject => (
            <button key={subject} className="subject-card" onClick={() => handleSubjectClick(subject)}>
              <span className="subject-name">{subject}</span>
            </button>
          ))}
        </div>
        <button className="back-button" onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
      </div>
    );
  }

  // === ЭКРАН: ВЫБОР КОЛИЧЕСТВА ===
  if (currentScreen === 'amount_select') {
    return (
      <div className="screen-container">
        <h2 className="title">{selectedSubject}</h2>
        <p style={{marginBottom: '20px'}}>Сколько задач хочешь решить?</p>
        <div className="buttons-column">
          <button className="primary-btn" onClick={() => handleStartTest(5)}>5 задач</button>
          <button className="primary-btn" onClick={() => handleStartTest(10)}>10 задач</button>
          <button className="primary-btn" onClick={() => handleStartTest(15)}>15 задач</button>
          <button className="back-button" onClick={() => setCurrentScreen('training')}>⬅ Отмена</button>
        </div>
      </div>
    );
  }


  // === ЭКРАН: САМ ТЕСТ ===
  if (currentScreen === 'solving') {
    const currentTask = tasks[currentTaskIdx];

    // Подготовка списка картинок (разбиваем строку по пробелам или запятым)
    const images = currentTask.image_url
      ? currentTask.image_url.split(/[\s,]+/).filter(url => url.trim() !== "")
      : [];

    return (
      <div className="screen-container solving-screen">
        <div className="task-header">
          <span>{selectedSubject}</span>
          <span>Вопрос {currentTaskIdx + 1} из {tasks.length}</span>
        </div>

        <div className="task-content">
          {/* Если есть картинки, выводим их списком */}
          {images.length > 0 && (
            <div className="task-images-container">
              {images.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Задача ${index + 1}`}
                  className="task-image"
                />
              ))}
            </div>
          )}

          <p className="task-text">{currentTask.question}</p>
        </div>

        <input
          type="text"
          className="answer-input"
          placeholder="Твой ответ..."
          value={answerInput}
          onChange={(e) => setAnswerInput(e.target.value)}
        />

        <button
          className="primary-btn submit-btn"
          onClick={handleNextTask}
          disabled={!answerInput.trim()}
        >
          {currentTaskIdx + 1 === tasks.length ? "Завершить тест" : "Дальше ➡"}
        </button>
      </div>
    );
  }

  // === ЭКРАН: РЕЗУЛЬТАТ ===
  if (currentScreen === 'result') {
    return (
      <div className="screen-container">
        <h2 className="title">🎉 Тест завершен!</h2>
        <div className="profile-card-real" style={{textAlign: 'center'}}>
          <p style={{fontSize: '1.2rem'}}>Твой результат:</p>
          <h1 style={{color: '#3aa1e9', margin: '10px 0'}}>{correctCount} / {tasks.length}</h1>
          <p>Баллы уже сохранены в твой профиль.</p>
        </div>

        <button
          className="primary-btn"
          onClick={() => {
            // Перезагружаем профиль, чтобы обновить баллы
            setLoading(true);
            fetch(`${API_URL}/get_user_data?user_id=${userId}`)
              .then(res => res.json())
              .then(data => {
                setUserData(data);
                setCurrentScreen('main');
                setLoading(false);
              });
          }}
          style={{marginTop: '20px'}}
        >
          Вернуться на главную
        </button>
      </div>
    );
  }

  return null;
}

export default App;