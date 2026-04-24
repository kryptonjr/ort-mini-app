import { useState, useEffect } from 'react';
import './App.css';
import schoolsData from './schools.json';

const tg = window.Telegram.WebApp;
const API_URL = "https://ort-bot.ru";

function App() {
  // === СОСТОЯНИЯ ПРИЛОЖЕНИЯ ===
  const [currentScreen, setCurrentScreen] = useState('main');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [schoolLeaderboard, setSchoolLeaderboard] = useState([]);
  const [leaderboardTab, setLeaderboardTab] = useState('personal');
  const [allUsers, setAllUsers] = useState([]);

  // Состояния регистрации
  const [regData, setRegData] = useState({ real_name: '', city: '', district: '', school: '' });

  // Опции и VIP
  const [useTimer, setUseTimer] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // VIP Фото-решебник
  const [photoData, setPhotoData] = useState(null);
  const [photoResult, setPhotoResult] = useState('');

  // === ТЕМА И ЦВЕТА ===
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme !== null) return savedTheme === 'dark';
    return tg.colorScheme === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('app_theme', isDarkTheme ? 'dark' : 'light');
    document.body.style.backgroundColor = isDarkTheme ? '#121212' : '#f4f7fb';
    try {
      tg.setHeaderColor(isDarkTheme ? '#121212' : '#f4f7fb');
      tg.setBackgroundColor(isDarkTheme ? '#121212' : '#f4f7fb');
    } catch (e) { console.log("Theme error:", e); }
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

  // Получение ID пользователя
  const urlParams = new URLSearchParams(window.location.search);
  const fallbackId = urlParams.get('user_id');
  const userId = tg.initDataUnsafe?.user?.id || fallbackId;

  // === ИНИЦИАЛИЗАЦИЯ ===
  useEffect(() => {
    tg.ready();
    tg.expand();

    if (userId) {
      Promise.all([
        fetch(`${API_URL}/get_user_data?user_id=${userId}`).then(res => res.json()),
        fetch(`${API_URL}/get_leaderboard`).then(res => res.json())
      ])
      .then(([userDataRes, leaderboardRes]) => {
        setUserData(userDataRes);
        setLeaderboard(leaderboardRes);
        setLoading(false);
      })
      .catch(err => {
        console.error("Init error:", err);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [userId]);

  // Таймер теста
  useEffect(() => {
    if (currentScreen === 'solving' && useTimer && timeLeft > 0) {
      const timerId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timerId);
    } else if (currentScreen === 'solving' && useTimer && timeLeft === 0) {
      alert("⏱ Время вышло! Тест завершен автоматически.");
      finishTest(correctCount, solvedIds, userAnswers);
    }
  }, [currentScreen, timeLeft, useTimer]);

  // === ОБРАБОТЧИКИ СОБЫТИЙ ===

  const handleRegister = () => {
    if (!regData.real_name || !regData.district || !regData.city || !regData.school) {
      alert("Пожалуйста, заполни все поля!");
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/update_profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, ...regData })
    })
    .then(res => res.json())
    .then(() => fetch(`${API_URL}/get_user_data?user_id=${userId}`))
    .then(res => res.json())
    .then(data => { setUserData(data); setLoading(false); })
    .catch(err => { alert("Ошибка сохранения."); setLoading(false); });
  };

  const handleBuyVip = () => {
    setShowPaymentModal(false);
    fetch(`${API_URL}/request_vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    })
    .then(() => alert("✅ Заявка отправлена! Ожидайте подтверждения."));
  };

  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    setCurrentScreen('amount_select');
  };

  const handleStartTest = (amount) => {
    setLoading(true);
    fetch(`${API_URL}/get_tasks?user_id=${userId}&subject=${encodeURIComponent(selectedSubject)}&amount=${amount}`)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          alert("Задачи по этому предмету закончились!");
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
      .catch(() => { alert("Ошибка загрузки."); setLoading(false); });
  };

  const handleNextTask = () => {
    const currentTask = tasks[currentTaskIdx];
    const isCorrect = answerInput.trim().toLowerCase() === String(currentTask.correct_answer).trim().toLowerCase();
    if (isCorrect) setCorrectCount(prev => prev + 1);

    const newAnswers = [...userAnswers, { task: currentTask, userAnswer: answerInput, isCorrect }];
    setUserAnswers(newAnswers);
    setSolvedIds([...solvedIds, currentTask.id]);
    setAnswerInput('');

    if (currentTaskIdx + 1 < tasks.length) setCurrentTaskIdx(prev => prev + 1);
    else finishTest(isCorrect ? correctCount + 1 : correctCount, [...solvedIds, currentTask.id], newAnswers);
  };

  const finishTest = (finalScore, finalIds, finalAnswers) => {
    setCurrentScreen('result');
    setIsAiLoading(true);
    const wrongTasks = finalAnswers.filter(ans => !ans.isCorrect).map(ans => ({
      question: ans.task.question,
      correct_answer: ans.task.correct_answer,
      user_answer: ans.userAnswer,
      explanation: ans.task.explanation
    }));

    fetch(`${API_URL}/save_result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, subject: selectedSubject, correct_count: finalScore, solved_ids: finalIds, wrong_tasks: wrongTasks })
    })
    .then(res => res.json())
    .then(data => {
      setAiFeedback(data.ai_feedback);
      setIsAiLoading(false);
    });
  };

  const handleSwitchLanguage = () => {
    setLoading(true);
    fetch(`${API_URL}/switch_language`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) })
    .then(() => fetch(`${API_URL}/get_user_data?user_id=${userId}`))
    .then(res => res.json())
    .then(data => { setUserData(data); setLoading(false); });
  };

  const getProfileIcon = () => {
    if (!userData) return '👤';
    const rank = leaderboard.findIndex(u => u.id === userData.id);
    if (rank === 0) return '🥇'; if (rank === 1) return '🥈'; if (rank === 2) return '🥉';
    if (userData.role === 'admin') return '👨‍💻'; if (userData.role === 'vip') return '👑';
    return '👤';
  };

  // === РЕНДЕРИНГ ЭКРАНОВ ===

  if (loading) return (
    <div className={`app-container modern-ui loader-screen ${isDarkTheme ? 'dark-theme' : ''}`}>
      <div className="modern-logo" style={{ fontSize: '2.5rem', marginBottom: '40px' }}>🧬 O.R.T. AI</div>
      <div className="spinner"></div>
    </div>
  );

  if (!userId) return (
    <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center'}}>
      <div style={{fontSize: '4rem', marginBottom: '10px'}}>🔒</div>
      <h2 className="title" style={{color: isDarkTheme ? '#fff' : '#111'}}>Доступ закрыт</h2>
      <p className="subtitle">Пожалуйста, запустите бота через мобильный телефон.</p>
    </div>
  );

  // Экран Регистрации
  if (userData && !userData.real_name) {
    const regions = Object.keys(schoolsData || {});
    const districts = regData.city && schoolsData[regData.city] ? Object.keys(schoolsData[regData.city]) : [];
    const schools = regData.district && schoolsData[regData.city]?.[regData.district] ? schoolsData[regData.city][regData.district] : [];
    const isFormValid = regData.real_name && regData.city && regData.district && regData.school;

    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`} style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
        <div className="modern-header"><div className="modern-logo">🧬 Регистрация</div><p className="subtitle">Выбери свою школу</p></div>
        <div className="answer-section" style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
          <input type="text" className="answer-input" placeholder="Имя и Фамилия" value={regData.real_name} onChange={(e) => setRegData({...regData, real_name: e.target.value})} />
          <select className="answer-input" value={regData.city} onChange={(e) => setRegData({...regData, city: e.target.value, district: '', school: ''})}><option value="">Область / Город</option>{regions.map(r => <option key={r} value={r}>{r}</option>)}</select>
          <select className="answer-input" value={regData.district} onChange={(e) => setRegData({...regData, district: e.target.value, school: ''})} disabled={!regData.city}><option value="">Район</option>{districts.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <select className="answer-input" value={regData.school} onChange={(e) => setRegData({...regData, school: e.target.value})} disabled={!regData.district}><option value="">Школа</option>{schools.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <button className="modern-btn lang-btn" onClick={handleRegister} disabled={!isFormValid} style={{ opacity: isFormValid ? 1 : 0.5 }}>💾 Сохранить и начать</button>
        </div>
      </div>
    );
  }

  // Главный экран
  if (currentScreen === 'main') {
    const totalScore = userData?.scores ? Object.values(userData.scores).reduce((a, b) => a + b, 0) : 0;
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
        {showPaymentModal && (
          <div className="modal-overlay">
            <div className="modal-content geometric-dark">
              <h3 style={{ marginBottom: '10px' }}>Оплата VIP-статуса</h3>
              <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px' }}>Отсканируй QR в приложении <b>MBank</b>.</p>
              <div className="qr-container"><img src="https://i.postimg.cc/fL92DHSX/qr.jpg" alt="QR" className="qr-image" /></div>
              <div className="modal-buttons"><button className="modern-btn lang-btn" onClick={handleBuyVip}>✅ Я оплатил</button><button className="modern-btn back-btn-outline" onClick={() => setShowPaymentModal(false)}>Отмена</button></div>
            </div>
          </div>
        )}
        <div className="modern-header"><div className="modern-logo">🧬 O.R.T. AI</div><h2>Привет, {userData?.first_name || 'Ученик'}!</h2></div>
        <div className="main-action-card" onClick={() => setCurrentScreen('training')}><div className="card-icon-large">📖</div><div className="card-text"><h3>Тренировка</h3><p>Начать подготовку</p></div></div>
        <div className="dashboard-grid">
          <div className="dash-card profile-card" onClick={() => setCurrentScreen('profile')}><div className="dash-icon">{getProfileIcon()}</div><h4>Профиль</h4><p>{totalScore} баллов</p></div>
          <div className="dash-card help-card" onClick={() => setCurrentScreen('help')}><div className="dash-icon">🆘</div><h4>Помощь</h4><p>Инструкции</p></div>
          <div className="dash-card leader-card" onClick={() => {
            setLoading(true);
            Promise.all([
              fetch(`${API_URL}/get_leaderboard`).then(res => res.json()),
              fetch(`${API_URL}/get_school_leaderboard`).then(res => res.json())
            ]).then(([usersData, schoolsData]) => {
              setLeaderboard(usersData); setSchoolLeaderboard(schoolsData); setCurrentScreen('leaderboard'); setLoading(false);
            }).catch(() => setLoading(false));
          }}><div className="dash-icon">🏆</div><h4>ТОП-10</h4><p>Лидеры</p></div>
        </div>

        <div className="scores-section">
          <h3 className="section-title">Мои Баллы</h3>
          <div className="scores-row scrollable-row">
            <div className="score-col score-snap"><div className="score-icon">🧮</div><span className="score-label">Math</span><div className="progress-bar"><div className="fill math-fill" style={{width: `${Math.min(((userData?.scores?.algebra || 0) + (userData?.scores?.geometry || 0)) * 2, 100)}%`}}></div></div><span className="score-val">{(userData?.scores?.algebra || 0) + (userData?.scores?.geometry || 0)} pts</span></div>
            <div className="score-col score-snap"><div className="score-icon">📜</div><span className="score-label">Grammar</span><div className="progress-bar"><div className="fill grammar-fill" style={{width: `${Math.min((userData?.scores?.grammar || 0) * 5, 100)}%`}}></div></div><span className="score-val">{userData?.scores?.grammar || 0} pts</span></div>
            <div className="score-col score-snap"><div className="score-icon">👁️</div><span className="score-label">Reading</span><div className="progress-bar"><div className="fill reading-fill" style={{width: `${Math.min((userData?.scores?.reading || 0) * 5, 100)}%`}}></div></div><span className="score-val">{userData?.scores?.reading || 0} pts</span></div>
            <div className="score-col score-snap"><div className="score-icon">🔗</div><span className="score-label">Analogies</span><div className="progress-bar"><div className="fill" style={{width: `${Math.min((userData?.scores?.analogies || 0) * 5, 100)}%`, background: '#9b59b6'}}></div></div><span className="score-val">{userData?.scores?.analogies || 0} pts</span></div>
            <div className="score-col score-snap"><div className="score-icon">📝</div><span className="score-label">Sentences</span><div className="progress-bar"><div className="fill" style={{width: `${Math.min((userData?.scores?.sentences || 0) * 5, 100)}%`, background: '#f39c12'}}></div></div><span className="score-val">{userData?.scores?.sentences || 0} pts</span></div>
          </div>
        </div>

        <button className="modern-btn vip-btn vip-premium-card" onClick={() => setShowPaymentModal(true)}>🚀 Купить VIP Разбор</button>
        {userData?.role === 'admin' && <button className="modern-btn" style={{background: '#2c3e50', color: 'white', marginTop: '10px'}} onClick={() => { setLoading(true); fetch(`${API_URL}/get_all_users`).then(res => res.json()).then(data => { setAllUsers(data); setCurrentScreen('admin_panel'); setLoading(false); }); }}>⚙️ Панель управления</button>}
        <button className="modern-btn exit-btn" onClick={() => tg.close()}>🚪 Выход</button>
      </div>
    );
  }

  // Экран Профиля
  if (currentScreen === 'profile') {
    const isRu = userData?.language !== 'kg';
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
        <div className="modern-profile-header">
          <div className="modern-logo" style={{ marginBottom: '15px' }}>🧬 O.R.T. AI</div>
          <div className="profile-title"><span className="profile-avatar">{getProfileIcon()}</span><h2>Мой профиль</h2></div>
          <p className="profile-greeting">Привет, {userData?.first_name || 'Ученик'}!</p>
          <p className="profile-meta">#ID: {userData?.id} | Школа: {userData?.school || 'Не указана'}</p>
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
          <button className="modern-btn theme-btn" onClick={() => setIsDarkTheme(!isDarkTheme)}>{isDarkTheme ? '☀️ Светлая тема' : '🌙 Темная тема'}</button>
          <button className="modern-btn lang-btn" onClick={handleSwitchLanguage} style={{marginBottom: '10px'}}>{isRu ? 'Кыргызча' : 'Русский'}</button>
          <button className="modern-btn back-btn-outline" onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
        </div>
      </div>
    );
  }

  // Экран Лидерборда
  if (currentScreen === 'leaderboard') {
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
        <div className="modern-header" style={{ marginBottom: '20px' }}><h2>🏆 Зал Славы</h2><p className="subtitle">Поднимай свою школу в ТОП!</p></div>
        <div className="leaderboard-tabs">
          <button className={`tab-btn ${leaderboardTab === 'personal' ? 'active-tab' : ''}`} onClick={() => setLeaderboardTab('personal')}>👤 Ученики</button>
          <button className={`tab-btn ${leaderboardTab === 'schools' ? 'active-tab' : ''}`} onClick={() => setLeaderboardTab('schools')}>🏫 Школы</button>
        </div>
        <div className="profile-card-real" style={{ background: 'transparent', boxShadow: 'none' }}>
          {leaderboardTab === 'personal' && (
            <div className="ranking-list">
              {leaderboard.length === 0 ? <p style={{textAlign:'center'}}>Нет данных.</p> : leaderboard.map((user, idx) => (
                <div key={user.id} className="ranking-item">
                  <div className="rank-position">{idx < 3 ? medals[idx] : <span className="rank-number">{idx + 1}</span>}</div>
                  <div className="rank-info"><b>{user.username ? `@${user.username}` : `Ученик #${user.id}`}</b></div>
                  <div className="rank-score">{user.total_score} <span>pts</span></div>
                </div>
              ))}
            </div>
          )}
          {leaderboardTab === 'schools' && (
            <div className="ranking-list">
              {schoolLeaderboard.length === 0 ? <p style={{textAlign:'center'}}>Школы пока без баллов.</p> : schoolLeaderboard.map((school, idx) => (
                <div key={idx} className="ranking-item school-item">
                  <div className="rank-position">{idx < 3 ? medals[idx] : <span className="rank-number">{idx + 1}</span>}</div>
                  <div className="rank-info"><b>{school.school}</b><span className="school-district">📍 {school.district} • 👥 {school.students_count} чел.</span></div>
                  <div className="rank-score school-score">{school.total_school_score} <span>pts</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="modern-btn back-btn-outline" style={{marginTop: '20px'}} onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
      </div>
    );
  }

  // Экран Тренировки
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
        <div className="modern-header" style={{ marginBottom: '30px' }}><h2>📚 Предметы</h2></div>
        <div className="subjects-grid-modern">{subjectsList.map(subj => (<div key={subj.name} className={`subject-card-modern ${subj.colorClass}`} onClick={() => handleSubjectClick(subj.name)}><div className="subject-icon-glass">{subj.icon}</div><span className="subject-name-modern">{subj.name}</span></div>))}</div>
        <div style={{ marginTop: '30px' }}>
          <button className="modern-btn vip-premium-card" style={{ width: '100%', padding: '20px' }} onClick={() => {
            if (userData?.role === 'vip' || userData?.role === 'admin') { setCurrentScreen('photo_solve'); setPhotoData(null); setPhotoResult(''); }
            else alert("🔒 Только для VIP!");
          }}>📸 VIP: Решить задачу по фото</button>
        </div>
        <button className="modern-btn back-btn-outline" style={{ marginTop: '20px' }} onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
      </div>
    );
  }

  // Экран Фото-решения
  if (currentScreen === 'photo_solve') {
    const handleImageUpload = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader(); reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image(); img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas'); const MAX_WIDTH = 1000;
          let width = img.width; let height = img.height;
          if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
          setPhotoData(canvas.toDataURL('image/jpeg', 0.8)); setPhotoResult('');
        };
      };
    };

    const sendPhotoToAI = () => {
      setLoading(true);
      fetch(`${API_URL}/solve_photo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, image_base64: photoData }) })
      .then(res => res.json()).then(data => { setPhotoResult(data.answer || "Ошибка."); setLoading(false); })
      .catch(() => { alert("Ошибка сервера."); setLoading(false); });
    };

    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
        <div className="modern-header"><h2>📸 Фото-разбор</h2></div>
        {!photoData ? (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <label htmlFor="photo-upload" className="modern-btn vip-premium-card" style={{ display: 'inline-block', padding: '25px', cursor: 'pointer', borderRadius: '20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📷</div> Камера / Галерея
            </label>
            <input id="photo-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <img src={photoData} alt="Preview" style={{ width: '100%', borderRadius: '16px' }} />
            {!photoResult ? (
              <div style={{ display: 'flex', gap: '10px' }}><button className="modern-btn lang-btn" onClick={sendPhotoToAI} style={{ flex: 2 }}>✨ Решить</button><button className="modern-btn back-btn-outline" onClick={() => setPhotoData(null)} style={{ flex: 1 }}>🔄 Другое</button></div>
            ) : (
              <div className="ai-feedback-box"><h3>🤖 Решение:</h3><div className="ai-text" dangerouslySetInnerHTML={{ __html: photoResult.replace(/\n/g, '<br/>') }} /></div>
            )}
          </div>
        )}
        <button className="modern-btn back-btn-outline" style={{ marginTop: '30px' }} onClick={() => setCurrentScreen('training')}>⬅ Назад</button>
      </div>
    );
  }

  // Экран Выбора количества задач
  if (currentScreen === 'amount_select') {
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`} style={{textAlign: 'center'}}>
        <h2 className="title">{selectedSubject}</h2>
        <div style={{background: isDarkTheme ? '#1e1e1e' : 'white', borderRadius: '16px', padding: '15px', marginBottom: '25px', border: `1px solid ${isDarkTheme ? '#333' : '#eee'}`}}>
           <p style={{marginBottom: '15px', fontWeight: 'bold'}}>Режим:</p>
           <div style={{display: 'flex', gap: '10px'}}>
             <div onClick={() => setUseTimer(true)} style={{padding: '12px', borderRadius: '12px', cursor: 'pointer', background: useTimer ? '#3aa1e9' : 'transparent', color: useTimer ? 'white' : '#888', border: '2px solid #3aa1e9', flex: 1, fontWeight: 'bold'}}>⏱ Время</div>
             <div onClick={() => setUseTimer(false)} style={{padding: '12px', borderRadius: '12px', cursor: 'pointer', background: !useTimer ? '#e74c3c' : 'transparent', color: !useTimer ? 'white' : '#888', border: '2px solid #e74c3c', flex: 1, fontWeight: 'bold'}}>🧘 Без таймера</div>
           </div>
        </div>
        <div className="buttons-column">
          <button className="modern-btn vip-btn" onClick={() => handleStartTest(5)}>5 задач</button>
          <button className="modern-btn vip-btn" onClick={() => handleStartTest(10)}>10 задач</button>
          <button className="modern-btn vip-btn" onClick={() => handleStartTest(15)}>15 задач</button>
          <button className="modern-btn back-btn-outline" style={{marginTop: '20px'}} onClick={() => setCurrentScreen('training')}>⬅ Отмена</button>
        </div>
      </div>
    );
  }

  // Экран Решения
  if (currentScreen === 'solving') {
    const currentTask = tasks[currentTaskIdx];
    const images = currentTask.image_url ? currentTask.image_url.split(/[\s,]+/).filter(url => url.trim() !== "") : [];
    const m = Math.floor(timeLeft / 60); const s = timeLeft % 60;
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
        <div className="task-header" style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
          <span>{selectedSubject} ({currentTaskIdx + 1}/{tasks.length})</span>
          <span style={{ color: (useTimer && timeLeft < 30) ? '#e74c3c' : 'inherit' }}>{useTimer ? `⏱ ${m}:${s < 10 ? '0' : ''}${s}` : '🧘'}</span>
        </div>
        <div className="task-content">
          {images.map((url, i) => <img key={i} src={url} alt="Task" className="task-image" />)}
          <p className="task-text">{currentTask.question}</p>
        </div>
        <div className="answer-section">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            {['А', 'Б', 'В', 'Г'].map(opt => (
              <button key={opt} onClick={() => setAnswerInput(opt)} style={{ flex: 1, padding: '15px', borderRadius: '12px', fontWeight: 'bold', background: answerInput.toUpperCase() === opt ? '#3aa1e9' : (isDarkTheme ? '#2c2c2c' : '#f4f7fb'), color: answerInput.toUpperCase() === opt ? 'white' : 'inherit', border: '2px solid #3aa1e9' }}>{opt}</button>
            ))}
          </div>
          <input type="text" className="answer-input" placeholder="Или введи ответ..." value={answerInput} onChange={(e) => setAnswerInput(e.target.value)} />
          <button className="modern-btn lang-btn" onClick={handleNextTask} disabled={!answerInput.trim()}>{currentTaskIdx + 1 === tasks.length ? "Завершить" : "Дальше ➡"}</button>
        </div>
      </div>
    );
  }

  // Экран Результатов
  if (currentScreen === 'result') {
    const mistakes = userAnswers.filter(ans => !ans.isCorrect);
    return (
      <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
        <h2 className="title">🎉 Тест завершен!</h2>
        <div className="stat-card-modern subj-blue" style={{flexDirection: 'column', padding: '30px', marginBottom: '30px'}}>
          <p style={{fontSize: '1.2rem', marginBottom: '10px', color: '#111'}}>Результат:</p>
          <h1 style={{fontSize: '3.5rem', margin: 0, color: '#111'}}>{correctCount} / {tasks.length}</h1>
        </div>
        {mistakes.map((m, idx) => (
          <div key={idx} className="task-content" style={{ border: '1px solid #ff4d4d', marginBottom: '15px' }}>
            <p style={{fontSize: '0.8rem', color: '#888'}}>ЗАДАНИЕ №{userAnswers.indexOf(m) + 1}</p>
            <p>{m.task.question}</p>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem', marginTop: '10px'}}>
              <div style={{padding: '10px', background: '#fff5f5', borderRadius: '8px', color: '#ff4d4d'}}><b>Твой:</b> {m.userAnswer}</div>
              <div style={{padding: '10px', background: '#f5fff5', borderRadius: '8px', color: '#27ae60'}}><b>Верно:</b> {m.task.correct_answer}</div>
            </div>
          </div>
        ))}
        <div className="ai-feedback-box">
          <h3>🤖 Анализ нейросети:</h3>
          {isAiLoading ? <div className="ai-loading">ИИ изучает ответы...</div> : <div className="ai-text" dangerouslySetInnerHTML={{ __html: aiFeedback.replace(/\n/g, '<br/>') }} />}
        </div>
        <button className="modern-btn lang-btn" onClick={() => { setLoading(true); fetch(`${API_URL}/get_user_data?user_id=${userId}`).then(res => res.json()).then(data => { setUserData(data); setCurrentScreen('main'); setLoading(false); }); }} style={{marginTop: '40px'}}>На главную</button>
      </div>
    );
  }

  // Экраны Помощи и Админки
  if (currentScreen === 'help') return (
    <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
      <div className="modern-header"><h2>🆘 Помощь</h2></div>
      <div className="ranking-list" style={{gap:'15px'}}>
        <div className="ranking-item"><b>📚 Учеба:</b> Решай задачи в разделе Тренировка.</div>
        <div className="ranking-item"><b>👑 VIP:</b> Получай разбор ошибок и решение по фото.</div>
        <div className="ranking-item"><b>🏆 Топ:</b> Твой балл — это сумма всех решенных задач.</div>
      </div>
      <button className="modern-btn back-btn-outline" style={{marginTop:'30px'}} onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
    </div>
  );

  if (currentScreen === 'admin_panel') return (
    <div className={`app-container modern-ui ${isDarkTheme ? 'dark-theme' : ''}`}>
      <div className="modern-header"><h2>👑 Админ-панель</h2><p className="subtitle">Всего учеников: {allUsers.length}</p></div>
      <div style={{overflowX: 'auto', marginBottom: '20px'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem'}}>
          <thead><tr style={{borderBottom: '2px solid #eee'}}><th style={{padding: '10px'}}>Имя</th><th style={{padding: '10px'}}>Роль</th><th style={{padding: '10px'}}>Школа</th></tr></thead>
          <tbody>
            {allUsers.map(user => (
              <tr key={user.id} style={{borderBottom: '1px solid #f9f9f9'}}>
                <td style={{padding: '10px'}}>{user.real_name || user.username}</td>
                <td style={{padding: '10px'}}>{user.role}</td>
                <td style={{padding: '10px'}}>{user.school || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="modern-btn back-btn-outline" onClick={() => setCurrentScreen('main')}>⬅ Назад</button>
    </div>
  );

  return null;
}

export default App;