import { useState, useEffect } from 'react';
import './App.css';


const tg = window.Telegram.WebApp;
const API_URL = "https://ort-bot.ru";

function App() {
  // === ОСНОВНЫЕ СОСТОЯНИЯ ===
  const [currentScreen, setCurrentScreen] = useState('main');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  // Опции
  const [useTimer, setUseTimer] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // === ОПЛАТА VIP ===
  const handleBuyVip = () => {
    setShowPaymentModal(false);
    fetch(`${API_URL}/request_vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    })
    .then(() => alert("✅ Заявка отправлена! Менеджер подтвердит оплату в ближайшее время."));
  };

  // === ТЕМА И ЦВЕТА ===
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme !== null) {
      return savedTheme === 'dark';
    }
    return tg.colorScheme === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('app_theme', isDarkTheme ? 'dark' : 'light');
    document.body.style.backgroundColor = isDarkTheme ? '#121212' : '#f4f7fb';
    try {
      tg.setHeaderColor(isDarkTheme ? '#121212' : '#f4f7fb');
      tg.setBackgroundColor(isDarkTheme ? '#121212' : '#f4f7fb');
    } catch (e) {
      console.log("Telegram API Theme Error:", e);
    }
  }, [isDarkTheme]);

  // === СОСТОЯНИЯ ТЕСТА ===
  const [selectedSubject, setSelectedSubject] = useState('');
  const [tasks, setTasks] = useState([]);
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
  const [answerInput, setAnswerInput] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [solvedIds, setSolvedIds] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [aiFeedback, setAiFeedback] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // === ПОЛУЧЕНИЕ ID ===
  const urlParams = new URLSearchParams(window.location.search);
  const fallbackId = urlParams.get('user_id');
  const userId = tg.initDataUnsafe?.user?.id || fallbackId;

  // === ИНИЦИАЛИЗАЦИЯ ===
  useEffect(() => {
    tg.ready();
    tg.expand();

    if (userId) {
      fetch(`${API_URL}/get_user_data?user_id=${userId}`)
        .then(res => res.json())
        .then(data => { setUserData(data); setLoading(false); })
        .catch(err => { console.error("Ошибка:", err); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [userId]);

  // === ТАЙМЕР ===
  useEffect(() => {
    if (currentScreen === 'solving' && useTimer && timeLeft > 0) {
      const timerId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timerId);
    } else if (currentScreen === 'solving' && useTimer && timeLeft === 0) {
      alert("⏱ Время вышло! Тест завершен автоматически.");
      finishTest(correctCount, solvedIds, userAnswers);
    }
  }, [currentScreen, timeLeft, useTimer]);

  // === ЛОГИКА ТЕСТОВ ===
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
        setTasks(data);
        setCurrentTaskIdx(0);
        setCorrectCount(0);
        setSolvedIds([]);
        setUserAnswers([]);
        setAiFeedback("");
        setTimeLeft(useTimer ? amount * 60 : -1);
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
    setSolvedIds([...solvedIds, currentTask.id]);
    setAnswerInput('');

    if (currentTaskIdx + 1 < tasks.length) {
      setCurrentTaskIdx(prev => prev + 1);
    } else {
      finishTest(isCorrect ? correctCount + 1 : correctCount, [...solvedIds, currentTask.id], newAnswers);
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
    .then(data => { setUserData(data); setLoading(false); });
  };

  // === ОТРИСОВКА ИНТЕРФЕЙСА ===

  if (loading) {
    return (
      <div className={`app-container modern-ui loader-screen ${isDarkTheme ? 'dark-theme' : ''}`}>
        <div className="modern-logo" style={{ fontSize: '2.5rem', marginBottom: '40px' }}>🧬 O.R.T. AI</div>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center'}}>
        <div style={{fontSize: '4rem', marginBottom: '10px'}}>🔒</div>
        <h2 className="title" style={{marginBottom: '10px', color: isDarkTheme ? '#fff' : '#111'}}>Доступ закрыт</h2>
        <p className="subtitle" style={{lineHeight: '1.5', color: isDarkTheme ? '#aaa' : '#666'}}>
          Телеграм не передал твой ID. Попробуй запустить бота с мобильного телефона или нажми /start.
        </p>
        <div style={{marginTop: '20px', padding: '15px', background: '#111', color: '#0f0', borderRadius: '12px', fontSize: '0.85rem', width: '100%', wordBreak: 'break-all', textAlign: 'left', border: '1px solid #333'}}>
          <b>⚙️ DEBUG INFO:</b><br/><br/>
          <b>initDataUnsafe:</b> {JSON.stringify(tg.initDataUnsafe)}<br/><br/>
          <b>version:</b> {tg.version || 'Не определена'}<br/>
          <b>platform:</b> {tg.platform || 'Не определена'}<br/>
          <b>fallback_id:</b> {fallbackId || 'Пусто'}
        </div>
      </div>
    );
  }

  if (currentScreen === 'main') {
    const totalScore = userData?.scores ? Object.values(userData.scores).reduce((a, b) => a + b, 0) : 0;
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>

        {/* МОДАЛЬНОЕ ОКНО ОПЛАТЫ */}
        {showPaymentModal && (
          <div className="modal-overlay">
            <div className="modal-content geometric-dark">
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.4rem' }}>Оплата VIP-статуса</h3>
              <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px' }}>
                Отсканируй QR-код через приложение <b>MBank</b> или сохрани картинку и загрузи в банк.
              </p>

              <div className="qr-container">
                {/* Вставляем прямую ссылку из интернета */}
                <img src="https://i.postimg.cc/fL92DHSX/qr.jpg" alt="QR MBank" className="qr-image" />
              </div>

              <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '20px' }}>
                После перевода обязательно нажми кнопку ниже, чтобы мы проверили платеж.
              </p>

              <div className="modal-buttons">
                <button className="modern-btn lang-btn" onClick={handleBuyVip}>✅ Я оплатил</button>
                <button className="modern-btn back-btn-outline" onClick={() => setShowPaymentModal(false)}>Отмена</button>
              </div>
            </div>
          </div>
        )}

        <div className="modern-header">
          <div className="modern-logo">🧬 O.R.T. AI</div>
          <h2>Привет, {userData?.first_name || 'Ученик'}!</h2>
          <p className="subtitle">Твой ИИ-помощник к ОРТ</p>
        </div>
        <div className="main-action-card" onClick={() => setCurrentScreen('training')}>
          <div className="card-icon-large">📖</div>
          <div className="card-text">
            <h3>Тренировка</h3>
            <p>Начать подготовку</p>
          </div>
        </div>
        <div className="dashboard-grid">
          <div className="dash-card profile-card" onClick={() => setCurrentScreen('profile')}>
            <div className="dash-icon">👤</div><h4>Профиль</h4><p>{totalScore} баллов</p>
          </div>
          <div className="dash-card help-card" onClick={() => setCurrentScreen('help')}>
            <div className="dash-icon">🆘</div><h4>Помощь</h4><p>Инструкции</p>
          </div>
          <div className="dash-card leader-card" onClick={() => {
            setLoading(true);
            fetch(`${API_URL}/get_leaderboard`).then(res => res.json()).then(data => {
              setLeaderboard(data); setCurrentScreen('leaderboard'); setLoading(false);
            });
          }}>
            <div className="dash-icon">🏆</div><h4>ТОП-10</h4><p>Лидеры</p>
          </div>
        </div>
        <div className="scores-section">
          <h3 className="section-title">Мои Баллы</h3>
          <div className="scores-row">
            <div className="score-col">
              <div className="score-icon">🧮</div><span className="score-label">Math</span>
              <div className="progress-bar"><div className="fill math-fill" style={{width: `${Math.min(((userData?.scores?.algebra || 0) + (userData?.scores?.geometry || 0)) * 2, 100)}%`}}></div></div>
              <span className="score-val">{(userData?.scores?.algebra || 0) + (userData?.scores?.geometry || 0)} pts</span>
            </div>
            <div className="score-col">
              <div className="score-icon">📜</div><span className="score-label">Grammar</span>
              <div className="progress-bar"><div className="fill grammar-fill" style={{width: `${Math.min((userData?.scores?.grammar || 0) * 5, 100)}%`}}></div></div>
              <span className="score-val">{userData?.scores?.grammar || 0} pts</span>
            </div>
            <div className="score-col">
              <div className="score-icon">👁️</div><span className="score-label">Reading</span>
              <div className="progress-bar"><div className="fill reading-fill" style={{width: `${Math.min((userData?.scores?.reading || 0) * 5, 100)}%`}}></div></div>
              <span className="score-val">{userData?.scores?.reading || 0} pts</span>
            </div>
          </div>
        </div>
        <button className="modern-btn vip-btn" onClick={() => setShowPaymentModal(true)}>🚀 Купить VIP Разбор</button>
        <button className="modern-btn exit-btn" onClick={() => tg.close()}>🚪 Выход</button>
      </div>
    );
  }

  if (currentScreen === 'profile') {
    const isRu = userData?.language !== 'kg';
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
        <div className="modern-profile-header">
          <div className="modern-logo" style={{ marginBottom: '15px' }}>🧬 O.R.T. AI</div>
          <div className="profile-title"><span className="profile-avatar">👨‍🎓</span><h2>Мой профиль</h2></div>
          <p className="profile-greeting">Привет, {userData?.first_name || 'Ученик'}!</p>
          <p className="profile-meta">#ID: {userData?.id} | {userData?.role}</p>
        </div>
        <div className="profile-stats-grid">
          <div className="stat-card-modern subj-blue"><div className="stat-icon-glass">🧮</div><div className="stat-text"><span className="stat-label">Алгебра</span><span className="stat-score">{userData?.scores?.algebra || 0} pts</span></div></div>
          <div className="stat-card-modern subj-green"><div className="stat-icon-glass">📐</div><div className="stat-text"><span className="stat-label">Геометрия</span><span className="stat-score">{userData?.scores?.geometry || 0} pts</span></div></div>
          <div className="stat-card-modern subj-purple"><div className="stat-icon-glass">🔗</div><div className="stat-text"><span className="stat-label">Аналогии</span><span className="stat-score">{userData?.scores?.analogies || 0} pts</span></div></div>
          <div className="stat-card-modern subj-orange"><div className="stat-icon-glass">📝</div><div className="stat-text"><span className="stat-label">Доп. предлож.</span><span className="stat-score">{userData?.scores?.sentences || 0} pts</span></div></div>
          <div className="stat-card-modern subj-teal"><div className="stat-icon-glass">📖</div><div className="stat-text"><span className="stat-label">Чтение</span><span className="stat-score">{userData?.scores?.reading || 0} pts</span></div></div>
          <div className="stat-card-modern subj-red"><div className="stat-icon-glass">🅰️</div><div className="stat-text"><span className="stat-label">Грамматика</span><span className="stat-score">{userData?.scores?.grammar || 0} pts</span></div></div>
        </div>
        <div className="profile-footer">
          <p className="tasks-solved">Решено задач: <b>{userData?.solved_tasks || 0}</b></p>
          <button className="modern-btn theme-btn" onClick={() => setIsDarkTheme(!isDarkTheme)}>{isDarkTheme ? '☀️ Включить светлую тему' : '🌙 Включить темную тему'}</button>
          <button className="modern-btn lang-btn" onClick={handleSwitchLanguage} style={{marginBottom: '10px'}}>{isRu ? 'Переключить на Кыргызча' : 'Переключить на Русский'}</button>
          <button className="modern-btn back-btn-outline" onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
        </div>
      </div>
    );
  }

  if (currentScreen === 'leaderboard') {
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
        <h2 className="title" style={{textAlign: 'center', marginBottom: '20px'}}>🏆 ТОП-10 УЧЕНИКОВ</h2>
        <div className="profile-card-real" style={{padding: '10px 20px', borderRadius: '16px'}}>
          {leaderboard.length === 0 ? (
            <p style={{textAlign: 'center'}}>Пока нет данных.</p>
          ) : (
            leaderboard.map((user, idx) => (
              <div key={user.id} style={{display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #eee'}}>
                <span>{idx < 3 ? medals[idx] : <span style={{opacity: 0.5}}>{idx + 1}.</span>}<b style={{marginLeft: '10px'}}>{user.username ? `@${user.username}` : `Ученик #${user.id}`}</b></span>
                <span style={{color: '#3aa1e9', fontWeight: 'bold'}}>{user.total_score} б.</span>
              </div>
            ))
          )}
        </div>
        <button className="modern-btn back-btn-outline" style={{marginTop: '20px'}} onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
      </div>
    );
  }

  if (currentScreen === 'help') {
    const helpInstructions = [
      { name: 'Учеба', icon: '📚', text: 'Жми «Тренировка», чтобы решать задачи.', colorClass: 'subj-blue' },
      { name: 'VIP', icon: '🤖', text: 'VIP: ИИ даст разбор ошибок в конце теста.', colorClass: 'subj-orange' },
      { name: 'ID', icon: '👤', text: 'Твой ID нужен для оплаты VIP-статуса.', colorClass: 'subj-purple' },
      { name: 'Язык', icon: '⚙️', text: 'Меняй язык в настройках Профиля.', colorClass: 'subj-green' }
    ];
    return (
      <div className={`app-container modern-ui help-modern ${isDarkTheme ? 'dark-theme' : ''}`}>
        <div className="modern-header" style={{ marginBottom: '30px' }}>
          <div className="modern-logo">🧬 O.R.T. AI</div>
          <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>🆘 Помощь</h2>
        </div>
        <div className="modern-dashboard-grid help-cards-grid">
          {helpInstructions.map((item, idx) => (
            <div key={idx} className={`stat-card-modern ${item.colorClass}`}><div className="stat-icon-glass">{item.icon}</div><div className="stat-text"><span className="stat-label help-title-modern">{item.name}</span><span className="stat-score help-subtitle">{item.text}</span></div></div>
          ))}
        </div>
        <div className="modern-dashboard-grid" style={{ marginBottom: '20px' }}>
           <div className="stat-card-modern vip-support-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', padding: '15px' }}>
              <div className="stat-icon-glass" style={{ minWidth: '45px' }}>📞</div><div className="stat-text" style={{ textAlign: 'left' }}><span className="stat-label help-title-modern" style={{ fontWeight: 'bold' }}>Поддержка</span><span className="stat-score help-subtitle">Связаться с нами</span></div>
              <a href="https://t.me/Altin_Supprot_bot" target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', textDecoration: 'none' }}><button className="modern-btn" style={{ padding: '8px 12px', fontSize: '0.9rem', width: 'auto', marginBottom: 0 }}>@Support</button></a>
           </div>
        </div>
        <button className="modern-btn back-btn-outline" onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
      </div>
    );
  }

  if (currentScreen === 'training') {
    const subjectsList = [
      { name: 'Алгебра', icon: '🧮', colorClass: 'subj-blue' },
      { name: 'Геометрия', icon: '📐', colorClass: 'subj-green' },
      { name: 'Аналогии', icon: '🔗', colorClass: 'subj-purple' },
      { name: 'Дополнение предложений', icon: '📝', colorClass: 'subj-orange' },
      { name: 'Чтение и понимание', icon: '📖', colorClass: 'subj-teal' },
      { name: 'Грамматика', icon: '🅰️', colorClass: 'subj-red' }
    ];
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
        <div className="modern-header" style={{ marginBottom: '30px' }}><div className="modern-logo">🧬 O.R.T. AI</div><h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>📚 Предметы</h2></div>
        <div className="subjects-grid-modern">
          {subjectsList.map(subj => (
            <div key={subj.name} className={`subject-card-modern ${subj.colorClass}`} onClick={() => handleSubjectClick(subj.name)}><div className="subject-icon-glass">{subj.icon}</div><span className="subject-name-modern">{subj.name}</span></div>
          ))}
        </div>
        <button className="modern-btn back-btn-outline" onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
      </div>
    );
  }

  if (currentScreen === 'amount_select') {
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`} style={{textAlign: 'center'}}>
        <h2 className="title" style={{marginBottom: '15px'}}>{selectedSubject}</h2>
        <div style={{background: isDarkTheme ? '#1e1e1e' : 'white', borderRadius: '16px', padding: '15px', marginBottom: '25px', border: `1px solid ${isDarkTheme ? '#333' : '#eee'}`}}>
           <p style={{marginBottom: '15px', fontWeight: 'bold', color: isDarkTheme ? '#fff' : '#111'}}>Режим прохождения:</p>
           <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
             <div onClick={() => setUseTimer(true)} style={{padding: '12px 10px', borderRadius: '12px', cursor: 'pointer', background: useTimer ? '#3aa1e9' : 'transparent', color: useTimer ? 'white' : (isDarkTheme ? '#aaa' : '#666'), border: `2px solid ${useTimer ? '#3aa1e9' : (isDarkTheme ? '#444' : '#eee')}`, flex: 1, fontWeight: 'bold', fontSize: '0.9rem'}}>⏱ На время</div>
             <div onClick={() => setUseTimer(false)} style={{padding: '12px 10px', borderRadius: '12px', cursor: 'pointer', background: !useTimer ? '#e74c3c' : 'transparent', color: !useTimer ? 'white' : (isDarkTheme ? '#aaa' : '#666'), border: `2px solid ${!useTimer ? '#e74c3c' : (isDarkTheme ? '#444' : '#eee')}`, flex: 1, fontWeight: 'bold', fontSize: '0.9rem'}}>🧘 Без таймера</div>
           </div>
        </div>
        <p className="subtitle" style={{marginBottom: '20px'}}>Сколько задач хочешь решить?</p>
        <div className="buttons-column">
          <button className="modern-btn vip-btn" onClick={() => handleStartTest(5)}>5 задач</button>
          <button className="modern-btn vip-btn" onClick={() => handleStartTest(10)}>10 задач</button>
          <button className="modern-btn vip-btn" onClick={() => handleStartTest(15)}>15 задач</button>
          <button className="modern-btn back-btn-outline" style={{marginTop: '20px'}} onClick={() => setCurrentScreen('training')}>⬅ Отмена</button>
        </div>
      </div>
    );
  }

  if (currentScreen === 'solving') {
    const currentTask = tasks[currentTaskIdx];
    const images = currentTask.image_url ? currentTask.image_url.split(/[\s,]+/).filter(url => url.trim() !== "") : [];
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    const timeString = `${m}:${s < 10 ? '0' : ''}${s}`;

    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
        <div className="task-header" style={{display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '15px'}}>
          <span style={{fontWeight: 'bold', color: '#888'}}>{selectedSubject} ({currentTaskIdx + 1}/{tasks.length})</span>
          <span style={{ fontWeight: 'bold', color: (useTimer && timeLeft < 60) ? '#e74c3c' : (isDarkTheme ? '#fff' : '#333') }}>{useTimer ? `⏱ ${timeString}` : '🧘 Без ограничений'}</span>
        </div>
        <div className="task-content" style={{background: isDarkTheme ? '#1e1e1e' : 'white', borderRadius: '16px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)'}}>
          {images.length > 0 && (
            <div className="task-images-container" style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px'}}>
              {images.map((url, i) => <img key={i} src={url} alt="Задание" className="task-image" style={{width: '100%', borderRadius: '8px'}} />)}
            </div>
          )}
          <p className="task-text" style={{lineHeight: '1.5', whiteSpace: 'pre-wrap', margin: 0}}>{currentTask.question}</p>
        </div>
        <div className="answer-section">
          <input type="text" className="answer-input" placeholder="Введи ответ (А, Б, В... или число)" value={answerInput} onChange={(e) => setAnswerInput(e.target.value)} style={{width: '100%', padding: '15px', borderRadius: '12px', border: '2px solid', borderColor: isDarkTheme ? '#444' : '#edf2f7', background: isDarkTheme ? '#2c2c2c' : 'white', color: isDarkTheme ? 'white' : 'black', marginBottom: '15px', fontSize: '1.1rem'}}/>
          <button className="modern-btn lang-btn" onClick={handleNextTask} disabled={!answerInput.trim()} style={{opacity: answerInput.trim() ? 1 : 0.5}}>
            {currentTaskIdx + 1 === tasks.length ? "Завершить тест" : "Дальше ➡"}
          </button>
        </div>
      </div>
    );
  }

  if (currentScreen === 'result') {
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
        <h2 className="title" style={{textAlign: 'center', marginBottom: '20px'}}>🎉 Тест завершен!</h2>
        <div className="stat-card-modern subj-blue" style={{flexDirection: 'column', padding: '30px', marginBottom: '20px'}}>
          <p style={{fontSize: '1.2rem', margin: '0 0 10px 0', opacity: 0.9}}>Твой результат:</p>
          <h1 style={{fontSize: '3rem', margin: 0, color: '#111'}}>{correctCount} / {tasks.length}</h1>
        </div>
        <div className="ai-feedback-box" style={{background: isDarkTheme ? '#1e1e1e' : '#f8f9fa', padding: '20px', borderRadius: '16px', borderLeft: '4px solid #3aa1e9'}}>
          {isAiLoading ? (
            <div className="ai-loading" style={{color: '#888', fontStyle: 'italic'}}>🤖 Проверка результатов...</div>
          ) : aiFeedback ? (
            <div className="ai-text" style={{lineHeight: '1.5'}} dangerouslySetInnerHTML={{ __html: aiFeedback.replace(/\n/g, '<br/>') }} />
          ) : (
            <div className="ai-text">Ошибок нет! Идеальная работа. 🏆</div>
          )}
        </div>
        <button className="modern-btn lang-btn" onClick={() => {
            setLoading(true);
            fetch(`${API_URL}/get_user_data?user_id=${userId}`).then(res => res.json()).then(data => { setUserData(data); setCurrentScreen('main'); setLoading(false); });
          }} style={{marginTop: '30px'}}>Вернуться на главную</button>
      </div>
    );
  }

  return null;
}

export default App;