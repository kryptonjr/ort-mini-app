import { useState, useEffect } from 'react';
import './App.css';

const tg = window.Telegram.WebApp;
const API_URL = "https://ort-bot.ru";

function App() {
  // === СОСТОЯНИЯ ПРИЛОЖЕНИЯ ===
  const [currentScreen, setCurrentScreen] = useState('main');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  // === СОСТОЯНИЯ ТЕСТА И ТАЙМЕРА ===
  const [selectedSubject, setSelectedSubject] = useState('');
  const [tasks, setTasks] = useState([]);
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
  const [answerInput, setAnswerInput] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [solvedIds, setSolvedIds] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [aiFeedback, setAiFeedback] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // Время в секундах

  // ID пользователя
  const userId = tg.initDataUnsafe?.user?.id || 1014543443;

  // --- 1. ЗАГРУЗКА ПРОФИЛЯ ПРИ СТАРТЕ ---
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

  // --- 2. ЛОГИКА ТАЙМЕРА ---
  useEffect(() => {
    if (currentScreen === 'solving' && timeLeft > 0) {
      const timerId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timerId);
    } else if (currentScreen === 'solving' && timeLeft === 0) {
      alert("⏱ Время вышло! Тест завершен автоматически.");
      finishTest(correctCount, solvedIds, userAnswers);
    }
  }, [currentScreen, timeLeft]);

  // --- 3. ФУНКЦИИ КНОПОК И НАВИГАЦИИ ---
  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    setCurrentScreen('amount_select');
  };

  const handleStartTest = (amount) => {
    setLoading(true);
    const encodedSubject = encodeURIComponent(selectedSubject);

    fetch(`${API_URL}/get_tasks?user_id=${userId}&subject=${encodedSubject}&amount=${amount}`)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          alert("Ты решил все задачи по этому предмету!");
          setLoading(false);
          setCurrentScreen('training');
          return;
        }
        // Сброс всех настроек перед новым тестом
        setTasks(data);
        setCurrentTaskIdx(0);
        setCorrectCount(0);
        setSolvedIds([]);
        setUserAnswers([]);
        setAiFeedback("");
        setTimeLeft(amount * 60); // Даем по 1 минуте на каждую задачу

        setCurrentScreen('solving');
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        alert("Ошибка загрузки задач.");
        setLoading(false);
      });
  };

  const handleNextTask = () => {
    const currentTask = tasks[currentTaskIdx];
    const isCorrect = answerInput.trim().toLowerCase() === String(currentTask.correct_answer).trim().toLowerCase();

    if (isCorrect) setCorrectCount(prev => prev + 1);

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

  const finishTest = (finalScore, finalIds, finalAnswers) => {
    setCurrentScreen('result');
    setIsAiLoading(true);

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
        wrong_tasks: wrongTasks
      })
    })
    .then(res => res.json())
    .then(data => {
      setAiFeedback(data.ai_feedback);
      setIsAiLoading(false);
    });
  };

  const handleSwitchLanguage = () => {
    setLoading(true);
    fetch(`${API_URL}/switch_language`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    })
    .then(() => fetch(`${API_URL}/get_user_data?user_id=${userId}`))
    .then(res => res.json())
    .then(data => {
      setUserData(data);
      setLoading(false);
    });
  };


  // === ОТРИСОВКА ИНТЕРФЕЙСА ===

  if (loading) return <div className="loading">Загрузка данных...</div>;

  // ЭКРАН 1: ГЛАВНЫЙ
  if (currentScreen === 'main') {
    // Считаем общую сумму баллов для профиля
    const totalScore = userData?.scores
      ? Object.values(userData.scores).reduce((a, b) => a + b, 0)
      : 0;

    return (
      <div className="app-container modern-ui">
        {/* Шапка */}
        <div className="modern-header">
          <div className="modern-logo">🧬 O.R.T. AI</div>
          <h2>Привет, {userData?.first_name || 'Ученик'}!</h2>
          <p className="subtitle">Твой ИИ-помощник к ОРТ</p>
        </div>

        {/* Главная кнопка тренировки */}
        <div className="main-action-card" onClick={() => setCurrentScreen('training')}>
          <div className="card-icon-large">📖</div>
          <div className="card-text">
            <h3>Тренировка</h3>
            <p>Начать подготовку</p>
          </div>
        </div>

        {/* Сетка из 3 кнопок */}
        <div className="dashboard-grid">
          <div className="dash-card profile-card" onClick={() => setCurrentScreen('profile')}>
            <div className="dash-icon">👤</div>
            <h4>Профиль</h4>
            <p>{totalScore} баллов</p>
          </div>

          <div className="dash-card help-card" onClick={() => setCurrentScreen('help')}>
            <div className="dash-icon">🆘</div>
            <h4>Помощь</h4>
            <p>Инструкции</p>
          </div>

          <div className="dash-card leader-card" onClick={() => {
            setLoading(true);
            fetch(`${API_URL}/get_leaderboard`).then(res => res.json()).then(data => {
              setLeaderboard(data);
              setCurrentScreen('leaderboard');
              setLoading(false);
            });
          }}>
            <div className="dash-icon">🏆</div>
            <h4>ТОП-10</h4>
            <p>Лидеры</p>
          </div>
        </div>

        {/* Блок "Мои Баллы" */}
        <div className="scores-section">
          <h3 className="section-title">Мои Баллы</h3>
          <div className="scores-row">
            {/* Математика (Алгебра + Геометрия) */}
            <div className="score-col">
              <div className="score-icon">🧮</div>
              <span className="score-label">Math</span>
              <div className="progress-bar"><div className="fill math-fill" style={{width: `${Math.min(((userData?.scores?.algebra || 0) + (userData?.scores?.geometry || 0)) * 2, 100)}%`}}></div></div>
              <span className="score-val">{(userData?.scores?.algebra || 0) + (userData?.scores?.geometry || 0)} pts</span>
            </div>

            {/* Грамматика */}
            <div className="score-col">
              <div className="score-icon">📜</div>
              <span className="score-label">Grammar</span>
              <div className="progress-bar"><div className="fill grammar-fill" style={{width: `${Math.min((userData?.scores?.grammar || 0) * 5, 100)}%`}}></div></div>
              <span className="score-val">{userData?.scores?.grammar || 0} pts</span>
            </div>

            {/* Чтение */}
            <div className="score-col">
              <div className="score-icon">👁️</div>
              <span className="score-label">Reading</span>
              <div className="progress-bar"><div className="fill reading-fill" style={{width: `${Math.min((userData?.scores?.reading || 0) * 5, 100)}%`}}></div></div>
              <span className="score-val">{userData?.scores?.reading || 0} pts</span>
            </div>
          </div>
        </div>

        {/* Нижние кнопки */}
        <button className="modern-btn vip-btn" onClick={() => alert('VIP-статус приобретается через поддержку!')}>
          🚀 VIP Разбор ИИ
        </button>
        <button className="modern-btn exit-btn" onClick={() => tg.close()}>
          🚪 Выход
        </button>
      </div>
    );
  }

  // ЭКРАН 2: ПРОФИЛЬ
  if (currentScreen === 'profile') {
    const isRu = userData?.language !== 'kg';

    return (
      <div className="app-container modern-ui">
        {/* Шапка профиля */}
        <div className="modern-profile-header">
          <div className="modern-logo" style={{ marginBottom: '15px' }}>🧬 O.R.T. AI</div>
          <div className="profile-title">
            <span className="profile-avatar">👨‍🎓</span>
            <h2>Мой профиль</h2>
          </div>
          <p className="profile-greeting">Привет, {userData?.first_name || 'Ученик'}!</p>
          <p className="profile-meta">#ID: {userData?.id} | {userData?.role}</p>
        </div>

        {/* Сетка баллов */}
        <div className="profile-stats-grid">
          <div className="stat-card-modern subj-blue">
            <div className="stat-icon-glass">🧮</div>
            <div className="stat-text">
              <span className="stat-label">Алгебра</span>
              <span className="stat-score">{userData?.scores?.algebra || 0} pts</span>
            </div>
          </div>

          <div className="stat-card-modern subj-green">
            <div className="stat-icon-glass">📐</div>
            <div className="stat-text">
              <span className="stat-label">Геометрия</span>
              <span className="stat-score">{userData?.scores?.geometry || 0} pts</span>
            </div>
          </div>

          <div className="stat-card-modern subj-purple">
            <div className="stat-icon-glass">🔗</div>
            <div className="stat-text">
              <span className="stat-label">Аналогии</span>
              <span className="stat-score">{userData?.scores?.analogies || 0} pts</span>
            </div>
          </div>

          <div className="stat-card-modern subj-orange">
            <div className="stat-icon-glass">📝</div>
            <div className="stat-text">
              <span className="stat-label">Доп. предлож.</span>
              <span className="stat-score">{userData?.scores?.sentences || 0} pts</span>
            </div>
          </div>

          <div className="stat-card-modern subj-teal">
            <div className="stat-icon-glass">📖</div>
            <div className="stat-text">
              <span className="stat-label">Чтение</span>
              <span className="stat-score">{userData?.scores?.reading || 0} pts</span>
            </div>
          </div>

          <div className="stat-card-modern subj-red">
            <div className="stat-icon-glass">🅰️</div>
            <div className="stat-text">
              <span className="stat-label">Грамматика</span>
              <span className="stat-score">{userData?.scores?.grammar || 0} pts</span>
            </div>
          </div>
        </div>

        {/* Подвал профиля */}
        <div className="profile-footer">
          <p className="tasks-solved">Решено задач: <b>{userData?.solved_tasks || 0}</b></p>

          <button className="modern-btn lang-btn" onClick={handleSwitchLanguage}>
            {isRu ? 'Переключить на Кыргызча' : 'Переключить на Русский'}
          </button>

          <button className="modern-btn back-btn-outline" onClick={() => setCurrentScreen('main')}>
            ⬅ Назад
          </button>
        </div>
      </div>
    );
  }

  // ЭКРАН 3: ТАБЛИЦА ЛИДЕРОВ
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
        <button className="back-button" onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
      </div>
    );
  }

  // === ЭКРАН: ПОМОЩЬ (MODERN UI) ===
  if (currentScreen === 'help') {
    // Список пунктов инструкции с иконками и цветами
    const helpInstructions = [
      { name: 'Учеба', icon: '📚', text: 'Жми «Тренировка», чтобы решать задачи.', colorClass: 'subj-blue' },
      { name: 'VIP', icon: '🤖', text: 'VIP: ИИ даст разбор ошибок в конце теста.', colorClass: 'subj-orange' },
      { name: 'ID', icon: '👤', text: 'Твой ID нужен для оплаты VIP-статуса.', colorClass: 'subj-purple' },
      { name: 'Язык', icon: '⚙️', text: 'Меняй язык в настройках Профиля.', colorClass: 'subj-green' }
    ];

    return (
      <div className="app-container modern-ui help-modern">
        {/* Шапка */}
        <div className="modern-header" style={{ marginBottom: '30px' }}>
          <div className="modern-logo">🧬 O.R.T. AI</div>
          <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            🆘 Помощь
          </h2>
        </div>

        {/* Сетка инструкции (4 карточки) */}
        <div className="modern-dashboard-grid help-cards-grid">
          {helpInstructions.map((item, idx) => (
            <div key={idx} className={`stat-card-modern ${item.colorClass}`}>
              <div className="stat-icon-glass">{item.icon}</div>
              <div className="stat-text">
                <span className="stat-label help-title-modern">{item.name}</span>
                <span className="stat-score help-subtitle">{item.text}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Блок Связи (Dashboard-стиль) */}
        <div className="modern-dashboard-grid" style={{ marginBottom: '20px' }}>
           <div className="stat-card-modern vip-support-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', padding: '15px' }}>
              <div className="stat-icon-glass" style={{ minWidth: '45px' }}>📞</div>
              <div className="stat-text" style={{ textAlign: 'left' }}>
                <span className="stat-label help-title-modern" style={{ fontWeight: 'bold' }}>Поддержка</span>
                <span className="stat-score help-subtitle">Связаться с нами</span>
              </div>
              {/* Ссылка */}
              <a href="https://t.me/Altin_Supprot_bot" target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
                <button className="modern-btn" style={{ padding: '8px 12px', fontSize: '0.9rem', width: 'auto' }}>@Altin_Supprot_bot</button>
              </a>
           </div>
        </div>

        {/* Кнопка Назад */}
        <button className="modern-btn back-btn-outline" onClick={() => setCurrentScreen('main')}>
          ⬅ Назад
        </button>
      </div>
    );
  }

  // ЭКРАН 5: ТРЕНИРОВКА (ВЫБОР ПРЕДМЕТА)
  if (currentScreen === 'training') {
    // Массив предметов с иконками и CSS-классами цветов
    const subjectsList = [
      { name: 'Алгебра', icon: '🧮', colorClass: 'subj-blue' },
      { name: 'Геометрия', icon: '📐', colorClass: 'subj-green' },
      { name: 'Аналогии', icon: '🔗', colorClass: 'subj-purple' },
      { name: 'Дополнение предложений', icon: '📝', colorClass: 'subj-orange' },
      { name: 'Чтение и понимание', icon: '📖', colorClass: 'subj-teal' },
      { name: 'Грамматика', icon: '🅰️', colorClass: 'subj-red' }
    ];

    return (
      <div className="app-container modern-ui">
        {/* Шапка */}
        <div className="modern-header" style={{ marginBottom: '30px' }}>
          <div className="modern-logo">🧬 O.R.T. AI</div>
          <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            📚 Предметы
          </h2>
        </div>

        {/* Сетка предметов */}
        <div className="subjects-grid-modern">
          {subjectsList.map(subj => (
            <div
              key={subj.name}
              className={`subject-card-modern ${subj.colorClass}`}
              onClick={() => handleSubjectClick(subj.name)}
            >
              <div className="subject-icon-glass">{subj.icon}</div>
              <span className="subject-name-modern">{subj.name}</span>
            </div>
          ))}
        </div>

        {/* Кнопка Назад */}
        <button className="modern-btn back-btn-outline" onClick={() => setCurrentScreen('main')}>
          ⬅ Назад
        </button>
      </div>
    );
  }

  // ЭКРАН 6: ВЫБОР КОЛИЧЕСТВА ЗАДАЧ
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

  // ЭКРАН 7: САМ ТЕСТ (С ТАЙМЕРОМ)
  if (currentScreen === 'solving') {
    const currentTask = tasks[currentTaskIdx];
    const images = currentTask.image_url ? currentTask.image_url.split(/[\s,]+/).filter(url => url.trim() !== "") : [];

    // Форматируем время таймера для вывода (мм:сс)
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    const timeString = `${m}:${s < 10 ? '0' : ''}${s}`;

    return (
      <div className="screen-container">
        <div className="task-header" style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
          <span>{selectedSubject} ({currentTaskIdx + 1}/{tasks.length})</span>
          <span style={{ fontWeight: 'bold', color: timeLeft < 60 ? '#e74c3c' : '#333' }}>
            ⏱ {timeString}
          </span>
        </div>

        <div className="task-content">
          {images.length > 0 && (
            <div className="task-images-container">
              {images.map((url, i) => <img key={i} src={url} alt="Задание" className="task-image" />)}
            </div>
          )}
          <p className="task-text">{currentTask.question}</p>
        </div>

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

  // ЭКРАН 8: РЕЗУЛЬТАТ И ИИ-РАЗБОР
  if (currentScreen === 'result') {
    return (
      <div className="screen-container">
        <h2 className="title">🎉 Тест завершен!</h2>
        <div className="profile-card-real" style={{textAlign: 'center', marginBottom: '20px'}}>
          <p style={{fontSize: '1.2rem'}}>Твой результат:</p>
          <h1 style={{color: '#3aa1e9', margin: '10px 0'}}>{correctCount} / {tasks.length}</h1>
        </div>

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