import { useState, useEffect } from 'react';
import './App.css';

const tg = window.Telegram.WebApp;
const API_URL = "https://ort-bot.ru";

function App() {
  const [currentScreen, setCurrentScreen] = useState('main');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  // Состояния для теста
  const [selectedSubject, setSelectedSubject] = useState('');
  const [tasks, setTasks] = useState([]);
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
  const [answerInput, setAnswerInput] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [solvedIds, setSolvedIds] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]); // Храним ответы для ИИ
  const [aiFeedback, setAiFeedback] = useState("");   // Текст от ИИ
  const [isAiLoading, setIsAiLoading] = useState(false); // Загрузка ИИ

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
    const encodedSubject = encodeURIComponent(selectedSubject);
    fetch(`${API_URL}/get_tasks?user_id=${userId}&subject=${encodedSubject}&amount=${amount}`)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          alert("Ты решил все задачи по этому предмету!");
          setLoading(false); return;
        }
        setTasks(data); setCurrentTaskIdx(0); setCorrectCount(0);
        setSolvedIds([]); setUserAnswers([]); setAiFeedback("");
        setCurrentScreen('solving'); setLoading(false);
      });
  };

  const handleNextTask = () => {
    const currentTask = tasks[currentTaskIdx];
    const isCorrect = answerInput.trim().toLowerCase() === String(currentTask.correct_answer).trim().toLowerCase();

    if (isCorrect) setCorrectCount(prev => prev + 1);

    // Сохраняем ответ пользователя для отправки ИИ
    const newAnswers = [...userAnswers, {
      task: currentTask,
      userAnswer: answerInput,
      isCorrect: isCorrect
    }];
    setUserAnswers(newAnswers);

    const newSolvedIds = [...solvedIds, currentTask.id];
    setSolvedIds(newSolvedIds);
    setAnswerInput('');

    if (currentTaskIdx + 1 < tasks.length) {
      setCurrentTaskIdx(prev => prev + 1);
    } else {
      finishTest(isCorrect ? correctCount + 1 : correctCount, newSolvedIds, newAnswers);
    }
  };
  const handleSwitchLanguage = () => {
    setLoading(true);
    fetch(`${API_URL}/switch_language`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    })
    .then(() => {
      // После смены языка заново скачиваем профиль, чтобы обновить данные
      return fetch(`${API_URL}/get_user_data?user_id=${userId}`);
    })
    .then(res => res.json())
    .then(data => {
      setUserData(data);
      setLoading(false);
    });
  };

  const finishTest = (finalScore, finalIds, finalAnswers) => {
    setCurrentScreen('result');
    setIsAiLoading(true);

    // Фильтруем только НЕВЕРНЫЕ ответы для ИИ
    const wrongTasks = finalAnswers
      .filter(ans => !ans.isCorrect)
      .map(ans => ({
        question: ans.task.question,
        correct_answer: ans.task.correct_answer,
        user_answer: ans.userAnswer,
        explanation: ans.task.explanation
      }));

    fetch(`${API_URL}/save_result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        subject: selectedSubject,
        correct_count: finalScore,
        solved_ids: finalIds,
        wrong_tasks: wrongTasks // Отправляем ошибки на бэкэнд
      })
    })
    .then(res => res.json())
    .then(data => {
      setAiFeedback(data.ai_feedback);
      setIsAiLoading(false);
    });
  };


  if (loading) return <div className="loading">Загрузка данных...</div>;

  // === ГЛАВНЫЙ ЭКРАН ===
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
          <button className="secondary-btn" onClick={() => setCurrentScreen('help')}>🆘 Помощь</button>
          <button className="danger-btn" onClick={() => tg.close()}>Выход</button>
        </div>
      </div>
    );
  }

  // === ЭКРАН: ПРОФИЛЬ ===
  if (currentScreen === 'profile') {
    const isRu = userData?.language !== 'kg'; // По умолчанию русский

    return (
      <div className="screen-container">
        <h2 className="title">👤 Мой профиль</h2>
        <div className="profile-card-real">
           <p>Имя: <b>{userData?.first_name}</b></p>
           <p>ID: <b>#{userData?.id}</b></p>
           <p>Статус: <span className="role-tag">{userData?.role}</span></p>
           <p>Язык: <b>{isRu ? '🇷🇺 Русский' : '🇰🇬 Кыргызча'}</b></p>

           <div className="stats-grid">
              <div className="stat-item"><span>Алгебра</span><b>{userData?.scores?.algebra}</b></div>
              <div className="stat-item"><span>Геометрия</span><b>{userData?.scores?.geometry}</b></div>
              <div className="stat-item"><span>Аналогии</span><b>{userData?.scores?.analogies}</b></div>
              <div className="stat-item"><span>Доп. предлож.</span><b>{userData?.scores?.sentences}</b></div>
              <div className="stat-item"><span>Чтение</span><b>{userData?.scores?.reading}</b></div>
              <div className="stat-item"><span>Грамматика</span><b>{userData?.scores?.grammar}</b></div>
           </div>
           <p style={{marginTop: '15px'}}>Решено задач: <b>{userData?.solved_tasks}</b></p>
        </div>

        <div className="buttons-column" style={{marginTop: '15px'}}>
          <button className="primary-btn" onClick={() => {
            setLoading(true);
            fetch(`${API_URL}/get_leaderboard`).then(res => res.json()).then(data => {
              setLeaderboard(data);
              setCurrentScreen('leaderboard');
              setLoading(false);
            });
          }}>🏆 Таблица лидеров</button>

          <button className="secondary-btn" onClick={handleSwitchLanguage}>
            {isRu ? '🇰🇬 Переключить на Кыргызча' : '🇷🇺 Переключить на Русский'}
          </button>

          <button className="back-button" onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
        </div>
      </div>
    );
  }

  // === ЭКРАН: ТАБЛИЦА ЛИДЕРОВ ===
  if (currentScreen === 'leaderboard') {
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <div className="screen-container">
        <h2 className="title">🏆 ТОП-10 УЧЕНИКОВ</h2>
        <div className="profile-card-real" style={{padding: '10px 20px'}}>
          {leaderboard.length === 0 ? (
            <p style={{textAlign: 'center'}}>Пока нет данных.</p>
          ) : (
            leaderboard.map((user, idx) => (
              <div key={user.id} style={{display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee'}}>
                <span>
                  {idx < 3 ? medals[idx] : `${idx + 1}. `}
                  <b>{user.username ? `@${user.username}` : `Ученик #${user.id}`}</b>
                </span>
                <span style={{color: '#3aa1e9', fontWeight: 'bold'}}>{user.total_score} б.</span>
              </div>
            ))
          )}
        </div>
        <button className="back-button" onClick={() => setCurrentScreen('profile')}>⬅ Назад</button>
      </div>
    );
  }

  // === ЭКРАН: ПОМОЩЬ ===
  if (currentScreen === 'help') {
    return (
      <div className="screen-container">
        <h2 className="title">🆘 Помощь</h2>
        <div className="profile-card-real" style={{textAlign: 'left'}}>
          <p>📖 <b>Инструкция по использованию:</b></p>
          <ol style={{paddingLeft: '20px', marginTop: '10px', lineHeight: '1.6'}}>
            <li>Жми «Тренировка», чтобы решать задачи.</li>
            <li>Если у тебя VIP, ИИ даст подробный разбор ошибок в конце теста.</li>
            <li>Твой ID в профиле нужен для оплаты VIP-статуса.</li>
            <li>Язык тестов можно поменять в настройках Профиля.</li>
          </ol>
          <p style={{marginTop: '20px'}}>📞 <b>Связь с поддержкой:</b></p>
          <a href="https://t.me/Altin_Supprot_bot" target="_blank" style={{color: '#3aa1e9', textDecoration: 'none', display: 'block', marginTop: '5px'}}>
            @Altin_Supprot_bot
          </a>
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
          {['Алгебра', 'Геометрия', 'Аналогии', 'Дополнение предложений', 'Чтение и понимание', 'Грамматика'].map(subject => (
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
    const images = currentTask.image_url ? currentTask.image_url.split(/[\s,]+/).filter(url => url.trim() !== "") : [];

    return (
      <div className="screen-container">
        <div className="task-header">
          <span>{selectedSubject}</span>
          <span>Вопрос {currentTaskIdx + 1} из {tasks.length}</span>
        </div>

        <div className="task-content">
          {images.length > 0 && (
            <div className="task-images-container">
              {images.map((url, i) => <img key={i} src={url} alt="Задание" className="task-image" />)}
            </div>
          )}
          <p className="task-text">{currentTask.question}</p>
        </div>

        {/* Поле ввода теперь сразу под вопросом! */}
        <div className="answer-section">
          <input
            type="text"
            className="answer-input"
            placeholder="Введи ответ (А, Б, В... или число)"
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
      </div>
    );
  }

  // === ЭКРАН: РЕЗУЛЬТАТ ===
  if (currentScreen === 'result') {
    return (
      <div className="screen-container">
        <h2 className="title">🎉 Тест завершен!</h2>
        <div className="profile-card-real" style={{textAlign: 'center', marginBottom: '20px'}}>
          <p style={{fontSize: '1.2rem'}}>Твой результат:</p>
          <h1 style={{color: '#3aa1e9', margin: '10px 0'}}>{correctCount} / {tasks.length}</h1>
        </div>

        {/* Блок с обратной связью от ИИ */}
        <div className="ai-feedback-box">
          {isAiLoading ? (
            <div className="ai-loading">🤖 Нейросеть проверяет ответы...</div>
          ) : aiFeedback ? (
            <div className="ai-text" dangerouslySetInnerHTML={{ __html: aiFeedback.replace(/\n/g, '<br/>') }} />
          ) : (
            <div className="ai-text">Ошибок нет! Идеальная работа. 🏆</div>
          )}
        </div>

        <button
          className="primary-btn"
          onClick={() => {
            setLoading(true);
            fetch(`${API_URL}/get_user_data?user_id=${userId}`)
              .then(res => res.json())
              .then(data => { setUserData(data); setCurrentScreen('main'); setLoading(false); });
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