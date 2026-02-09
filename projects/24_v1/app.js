// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signInAnonymously,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc,
    getDocs,
    updateDoc,
    onSnapshot,
    query,
    where,
    deleteDoc,
    serverTimestamp,
    increment,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ============================================
// FIREBASE CONFIGURATION
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyAJ4XxKytAUvrAOBbcUR8f-mls_IfIZkxA",
    authDomain: "game24-multiplayer-4b38a.firebaseapp.com",
    projectId: "game24-multiplayer-4b38a",
    storageBucket: "game24-multiplayer-4b38a.firebasestorage.app",
    messagingSenderId: "965076056957",
    appId: "1:965076056957:web:41692a8300d95641096a14",
    measurementId: "G-EX5XH8YQY8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================
// SIMPLE PASSWORD HASHING (Client-side)
// ============================================
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================
// GAME STATE
// ============================================
let currentUser = null;
let userProfile = null;
let gameId = null;
let gameData = null;
let opponent = null;
let cards = [];
let gameTimer = null;
let timeLeft = 60;
let gameStartTime = null;
let waitingUnsubscribe = null;
let gameUnsubscribe = null;
let selectedCards = [];
let isGuest = false;

// ============================================
// DOM ELEMENTS
// ============================================
const screens = {
    auth: document.getElementById('authScreen'),
    menu: document.getElementById('menuScreen'),
    searching: document.getElementById('searchingScreen'),
    game: document.getElementById('gameScreen'),
    result: document.getElementById('resultScreen')
};

const authElements = {
    loginTab: document.getElementById('loginTab'),
    signupTab: document.getElementById('signupTab'),
    guestTab: document.getElementById('guestTab'),
    loginForm: document.getElementById('loginForm'),
    signupForm: document.getElementById('signupForm'),
    guestForm: document.getElementById('guestForm'),
    loginUsername: document.getElementById('loginEmail'), // Repurposing email field
    loginPassword: document.getElementById('loginPassword'),
    loginBtn: document.getElementById('loginBtn'),
    loginMessage: document.getElementById('loginMessage'),
    signupUsername: document.getElementById('signupUsername'),
    signupPassword: document.getElementById('signupPassword'),
    signupBtn: document.getElementById('signupBtn'),
    signupMessage: document.getElementById('signupMessage'),
    guestBtn: document.getElementById('guestBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    userDisplayName: document.getElementById('userDisplayName')
};

const elements = {
    findMatchBtn: document.getElementById('findMatchBtn'),
    cancelSearchBtn: document.getElementById('cancelSearchBtn'),
    submitBtn: document.getElementById('submitBtn'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    expressionInput: document.getElementById('expressionInput'),
    cardsContainer: document.getElementById('cardsContainer'),
    timeLeftDisplay: document.getElementById('timeLeft'),
    gameMessage: document.getElementById('gameMessage'),
    userRating: document.getElementById('userRating'),
    userWins: document.getElementById('userWins'),
    userLosses: document.getElementById('userLosses'),
    yourRating: document.getElementById('yourRating'),
    yourName: document.getElementById('yourName'),
    opponentRating: document.getElementById('opponentRating'),
    opponentName: document.getElementById('opponentName'),
    yourStatus: document.getElementById('yourStatus'),
    opponentStatus: document.getElementById('opponentStatus'),
    resultTitle: document.getElementById('resultTitle'),
    yourSolution: document.getElementById('yourSolution'),
    opponentSolution: document.getElementById('opponentSolution'),
    yourTime: document.getElementById('yourTime'),
    opponentTime: document.getElementById('opponentTime'),
    ratingChange: document.getElementById('ratingChange'),
    leaderboardList: document.getElementById('leaderboardList'),
    addNumberBtn: document.getElementById('addNumberBtn')
};

// ============================================
// LOCAL STORAGE FOR SESSION
// ============================================
function saveSession(username, uid) {
    localStorage.setItem('game24_username', username);
    localStorage.setItem('game24_uid', uid);
}

function getSession() {
    return {
        username: localStorage.getItem('game24_username'),
        uid: localStorage.getItem('game24_uid')
    };
}

function clearSession() {
    localStorage.removeItem('game24_username');
    localStorage.removeItem('game24_uid');
}

// ============================================
// AUTHENTICATION UI
// ============================================

// Tab switching
authElements.loginTab.addEventListener('click', () => {
    setActiveTab('login');
});

authElements.signupTab.addEventListener('click', () => {
    setActiveTab('signup');
});

authElements.guestTab.addEventListener('click', () => {
    setActiveTab('guest');
});

function setActiveTab(tab) {
    // Reset tab buttons
    authElements.loginTab.classList.remove('active');
    authElements.signupTab.classList.remove('active');
    authElements.guestTab.classList.remove('active');
    
    // Hide all forms
    authElements.loginForm.classList.add('hidden');
    authElements.signupForm.classList.add('hidden');
    authElements.guestForm.classList.add('hidden');
    
    // Show selected
    if (tab === 'login') {
        authElements.loginTab.classList.add('active');
        authElements.loginForm.classList.remove('hidden');
    } else if (tab === 'signup') {
        authElements.signupTab.classList.add('active');
        authElements.signupForm.classList.remove('hidden');
    } else if (tab === 'guest') {
        authElements.guestTab.classList.add('active');
        authElements.guestForm.classList.remove('hidden');
    }
}

// Login
authElements.loginBtn.addEventListener('click', async () => {
    const username = authElements.loginUsername.value.trim();
    const password = authElements.loginPassword.value;
    
    if (!username || !password) {
        showAuthMessage('login', 'Please enter username and password', true);
        return;
    }
    
    authElements.loginBtn.disabled = true;
    authElements.loginBtn.textContent = 'Logging in...';
    
    try {
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Check if username exists
        const accountsRef = collection(db, 'accounts');
        const q = query(accountsRef, where('username', '==', username));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            showAuthMessage('login', 'Username not found', true);
            authElements.loginBtn.disabled = false;
            authElements.loginBtn.textContent = 'Login';
            return;
        }
        
        const accountDoc = snapshot.docs[0];
        const accountData = accountDoc.data();
        
        // Verify password
        if (accountData.passwordHash !== passwordHash) {
            showAuthMessage('login', 'Wrong password', true);
            authElements.loginBtn.disabled = false;
            authElements.loginBtn.textContent = 'Login';
            return;
        }
        
        // Login successful - create anonymous session
        const userCredential = await signInAnonymously(auth);
        
        // Link to existing account
        saveSession(username, userCredential.user.uid);
        
        // Update account with new UID (in case they login from different device)
        await updateDoc(doc(db, 'accounts', accountDoc.id), {
            lastUid: userCredential.user.uid,
            lastLogin: serverTimestamp()
        });
        
        showAuthMessage('login', 'Login successful!', false);
        
    } catch (error) {
        console.error('Login error:', error);
        showAuthMessage('login', 'Login failed: ' + error.message, true);
        authElements.loginBtn.disabled = false;
        authElements.loginBtn.textContent = 'Login';
    }
});

// Signup
authElements.signupBtn.addEventListener('click', async () => {
    const username = authElements.signupUsername.value.trim();
    const password = authElements.signupPassword.value;
    
    if (!username) {
        showAuthMessage('signup', 'Please enter a username', true);
        return;
    }
    
    if (username.length < 3) {
        showAuthMessage('signup', 'Username must be at least 3 characters', true);
        return;
    }
    
    if (username.length > 20) {
        showAuthMessage('signup', 'Username must be less than 20 characters', true);
        return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showAuthMessage('signup', 'Username can only contain letters, numbers, and underscores', true);
        return;
    }
    
    if (!password || password.length < 6) {
        showAuthMessage('signup', 'Password must be at least 6 characters', true);
        return;
    }
    
    authElements.signupBtn.disabled = true;
    authElements.signupBtn.textContent = 'Creating account...';
    
    try {
        // Check if username already exists
        const accountsRef = collection(db, 'accounts');
        const q = query(accountsRef, where('username', '==', username));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            showAuthMessage('signup', 'Username already taken', true);
            authElements.signupBtn.disabled = false;
            authElements.signupBtn.textContent = 'Sign Up';
            return;
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Create anonymous auth
        const userCredential = await signInAnonymously(auth);
        
        // Create account document
        const accountId = `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(doc(db, 'accounts', accountId), {
            username: username,
            passwordHash: passwordHash,
            createdAt: serverTimestamp(),
            lastUid: userCredential.user.uid,
            lastLogin: serverTimestamp()
        });
        
        // Save session
        saveSession(username, userCredential.user.uid);
        
        showAuthMessage('signup', 'Account created!', false);
        
    } catch (error) {
        console.error('Signup error:', error);
        showAuthMessage('signup', 'Signup failed: ' + error.message, true);
        authElements.signupBtn.disabled = false;
        authElements.signupBtn.textContent = 'Sign Up';
    }
});

// Guest login
authElements.guestBtn.addEventListener('click', async () => {
    authElements.guestBtn.disabled = true;
    authElements.guestBtn.textContent = 'Connecting...';
    
    try {
        isGuest = true;
        clearSession(); // Clear any saved session
        await signInAnonymously(auth);
    } catch (error) {
        alert('Failed to connect as guest: ' + error.message);
        authElements.guestBtn.disabled = false;
        authElements.guestBtn.textContent = 'Continue as Guest';
    }
});

// Logout
authElements.logoutBtn.addEventListener('click', async () => {
    try {
        clearSession();
        await auth.signOut();
        showScreen('auth');
        authElements.logoutBtn.style.display = 'none';
        isGuest = false;
        location.reload(); // Refresh to clear state
    } catch (error) {
        console.error('Logout error:', error);
    }
});

function showAuthMessage(form, message, isError) {
    const messageEl = form === 'login' ? authElements.loginMessage : authElements.signupMessage;
    messageEl.textContent = message;
    messageEl.className = isError ? 'auth-message error' : 'auth-message success';
}

// Allow Enter key to submit
authElements.loginUsername.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') authElements.loginBtn.click();
});
authElements.loginPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') authElements.loginBtn.click();
});
authElements.signupUsername.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') authElements.signupPassword.focus();
});
authElements.signupPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') authElements.signupBtn.click();
});

// ============================================
// GAME 24 LOGIC
// ============================================

// Check if numbers can make 24
function canMake24(numbers) {
    if (numbers.length === 1) {
        return Math.abs(numbers[0] - 24) < 0.0001;
    }
    
    for (let i = 0; i < numbers.length; i++) {
        for (let j = 0; j < numbers.length; j++) {
            if (i === j) continue;
            
            const remaining = numbers.filter((_, idx) => idx !== i && idx !== j);
            const a = numbers[i];
            const b = numbers[j];
            
            const operations = [
                a + b,
                a - b,
                a * b,
                b !== 0 ? a / b : null
            ];
            
            for (const result of operations) {
                if (result !== null && canMake24([...remaining, result])) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Generate 4 random cards that can make 24
function generateCards() {
    let attempts = 0;
    while (attempts < 100) {
        const newCards = [];
        for (let i = 0; i < 4; i++) {
            newCards.push(Math.floor(Math.random() * 13) + 1);
        }
        if (canMake24(newCards)) {
            return newCards;
        }
        attempts++;
    }
    // Fallback to a known solvable combination
    return [8, 8, 3, 5]; // (8+8)+(3+5) = 24
}

// Safe math expression evaluator (no eval!)
function safeMathEval(expr) {
    // Remove all whitespace
    expr = expr.replace(/\s+/g, '');
    
    // Tokenize the expression
    const tokens = expr.match(/(\d+\.?\d*|[+\-*/()])/g);
    if (!tokens) return null;
    
    let pos = 0;
    
    function peek() {
        return tokens[pos];
    }
    
    function consume() {
        return tokens[pos++];
    }
    
    function parseExpression() {
        let result = parseTerm();
        
        while (peek() === '+' || peek() === '-') {
            const op = consume();
            const right = parseTerm();
            if (result === null || right === null) return null;
            result = op === '+' ? result + right : result - right;
        }
        
        return result;
    }
    
    function parseTerm() {
        let result = parseFactor();
        
        while (peek() === '*' || peek() === '/') {
            const op = consume();
            const right = parseFactor();
            if (result === null || right === null) return null;
            if (op === '/' && right === 0) return null;
            result = op === '*' ? result * right : result / right;
        }
        
        return result;
    }
    
    function parseFactor() {
        const token = peek();
        
        if (token === '(') {
            consume(); // consume '('
            const result = parseExpression();
            if (peek() !== ')') return null;
            consume(); // consume ')'
            return result;
        }
        
        if (token === '-') {
            consume(); // consume '-'
            const result = parseFactor();
            return result === null ? null : -result;
        }
        
        if (/^\d+\.?\d*$/.test(token)) {
            consume();
            return parseFloat(token);
        }
        
        return null;
    }
    
    const result = parseExpression();
    
    // Make sure we consumed all tokens
    if (pos !== tokens.length) return null;
    
    return result;
}

// Evaluate expression and check if it equals 24
function evaluateExpression(expr, cards) {
    try {
        // Extract numbers from expression
        const numbersInExpr = expr.match(/\d+/g)?.map(Number) || [];
        const cardsCopy = [...cards];
        
        // Check if all numbers in expression are from cards
        for (const num of numbersInExpr) {
            const idx = cardsCopy.indexOf(num);
            if (idx === -1) {
                return { valid: false, result: null, error: 'Use only the given cards!' };
            }
            cardsCopy.splice(idx, 1);
        }
        
        // Check if all cards are used
        if (cardsCopy.length !== 0 || numbersInExpr.length !== 4) {
            return { valid: false, result: null, error: 'You must use all 4 cards exactly once!' };
        }
        
        // Validate expression contains only allowed characters
        if (!/^[\d+\-*/()\s]+$/.test(expr)) {
            return { valid: false, result: null, error: 'Invalid characters! Use only +, -, *, /, (, )' };
        }
        
        // Evaluate the expression using safe parser (NO eval!)
        const result = safeMathEval(expr);
        
        if (result === null) {
            return { valid: false, result: null, error: 'Invalid expression format!' };
        }
        
        return { valid: true, result, error: null };
    } catch (error) {
        return { valid: false, result: null, error: 'Invalid expression format!' };
    }
}

// ============================================
// ELO RATING SYSTEM
// ============================================

function calculateEloChange(winnerRating, loserRating, K = 32) {
    const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));
    
    return {
        winnerChange: Math.round(K * (1 - expectedWinner)),
        loserChange: Math.round(K * (0 - expectedLoser))
    };
}
// ============================================
// AUTHENTICATION
// ============================================

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadOrCreateUserProfile(user.uid);
        await loadLeaderboard();
        
        // Update display name
        const displayName = user.displayName || (isGuest ? 'Guest' : 'Player');
        authElements.userDisplayName.textContent = displayName;
        authElements.logoutBtn.style.display = 'block';
        
        // Show menu screen
        showScreen('menu');
    } else {
        // Show auth screen
        showScreen('auth');
    }
});

async function loadOrCreateUserProfile(uid) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
        userProfile = userSnap.data();
    } else {
        const displayName = currentUser.displayName || (isGuest ? 'Guest' : 'Player');
        userProfile = {
            uid,
            displayName: displayName,
            rating: 1200,
            wins: 0,
            losses: 0,
            createdAt: serverTimestamp()
        };
        await setDoc(userRef, userProfile);
    }
    
    updateUserStatsDisplay();
}

function updateUserStatsDisplay() {
    elements.userRating.textContent = userProfile.rating;
    elements.userWins.textContent = userProfile.wins;
    elements.userLosses.textContent = userProfile.losses;
    elements.yourRating.textContent = userProfile.rating;
    elements.yourName.textContent = userProfile.displayName || 'You';
}

// ============================================
// LEADERBOARD
// ============================================

async function loadLeaderboard() {
    try {
        const q = query(
            collection(db, 'users'),
            orderBy('rating', 'desc'),
            limit(10)
        );
        
        const snapshot = await getDocs(q);
        let html = '';
        let rank = 1;
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            const isCurrentUser = doc.id === currentUser.uid;
            const displayName = data.displayName || 'Player';
            html += `
                <div class="leaderboard-item" style="${isCurrentUser ? 'background: #e3f2fd; font-weight: bold;' : ''}">
                    <span class="leaderboard-rank">#${rank}</span>
                    <span>${isCurrentUser ? 'You (' + displayName + ')' : displayName}</span>
                    <span>${data.rating} (${data.wins}W/${data.losses}L)</span>
                </div>
            `;
            rank++;
        });
        
        elements.leaderboardList.innerHTML = html || '<p>No players yet!</p>';
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        elements.leaderboardList.innerHTML = '<p>Failed to load leaderboard</p>';
    }
}

// ============================================
// MATCHMAKING
// ============================================

elements.findMatchBtn.addEventListener('click', findMatch);
elements.cancelSearchBtn.addEventListener('click', cancelSearch);

async function findMatch() {
    if (!currentUser) return;
    
    showScreen('searching');
    
    try {
        // Check for waiting players
        const waitingRef = collection(db, 'waiting');
        const q = query(waitingRef, where('searching', '==', true));
        const snapshot = await getDocs(q);
        
        let foundOpponent = false;
        
        snapshot.forEach(async (docSnap) => {
            if (docSnap.id !== currentUser.uid && !foundOpponent) {
                foundOpponent = true;
                const opponentId = docSnap.id;
                
                // Delete waiting entry
                await deleteDoc(doc(db, 'waiting', opponentId));
                
                // Create game
                await createGame(currentUser.uid, opponentId);
            }
        });
        
        if (!foundOpponent) {
            // Add to waiting queue
            await setDoc(doc(db, 'waiting', currentUser.uid), {
                searching: true,
                rating: userProfile.rating,
                timestamp: serverTimestamp()
            });
            
            // Listen for game creation
            waitingUnsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), async (snapshot) => {
                const data = snapshot.data();
                if (data?.currentGame) {
                    if (waitingUnsubscribe) waitingUnsubscribe();
                    gameId = data.currentGame;
                    await startGameListener();
                }
            });
        }
    } catch (error) {
        console.error('Error finding match:', error);
        showMessage('Error finding match. Please try again.', true);
        showScreen('menu');
    }
}

async function cancelSearch() {
    if (waitingUnsubscribe) {
        waitingUnsubscribe();
        waitingUnsubscribe = null;
    }
    
    try {
        await deleteDoc(doc(db, 'waiting', currentUser.uid));
    } catch (error) {
        console.error('Error canceling search:', error);
    }
    
    showScreen('menu');
}

// ============================================
// GAME CREATION
// ============================================

async function createGame(player1Id, player2Id) {
    gameId = `${player1Id}_${player2Id}_${Date.now()}`;
    const newCards = generateCards();
    
    const newGameData = {
        player1: player1Id,
        player2: player2Id,
        cards: newCards,
        startTime: serverTimestamp(),
        timeLimit: 60,
        player1Solution: null,
        player2Solution: null,
        player1Time: null,
        player2Time: null,
        winner: null,
        status: 'active'
    };
    
    await setDoc(doc(db, 'games', gameId), newGameData);
    await updateDoc(doc(db, 'users', player1Id), { currentGame: gameId });
    await updateDoc(doc(db, 'users', player2Id), { currentGame: gameId });
    
    await startGameListener();
}

// ============================================
// GAME LISTENER
// ============================================

async function startGameListener() {
    gameUnsubscribe = onSnapshot(doc(db, 'games', gameId), async (snapshot) => {
        const data = snapshot.data();
        if (data) {
            gameData = data;
            cards = data.cards;
            
            // Load opponent profile
            const opponentId = data.player1 === currentUser.uid ? data.player2 : data.player1;
            const opponentSnap = await getDoc(doc(db, 'users', opponentId));
            opponent = opponentSnap.data();
            
            elements.opponentRating.textContent = opponent.rating;
            elements.opponentName.textContent = opponent.displayName || 'Opponent';
            
            // Update status indicators
            updateGameStatus();
            
            // Check for game end
            if (data.status === 'completed') {
                handleGameEnd();
            } else if (gameTimer === null) {
                // Start the game
                showScreen('game');
                renderCards();
                startTimer();
            }
        }
    });
}

function updateGameStatus() {
    const isPlayer1 = gameData.player1 === currentUser.uid;
    const mySolution = isPlayer1 ? gameData.player1Solution : gameData.player2Solution;
    const opponentSolution = isPlayer1 ? gameData.player2Solution : gameData.player1Solution;
    
    if (mySolution) {
        elements.yourStatus.innerHTML = '✅ Solved!';
    } else {
        elements.yourStatus.innerHTML = '⏳ Solving...';
    }
    
    if (opponentSolution) {
        elements.opponentStatus.innerHTML = '✅ Solved!';
    } else {
        elements.opponentStatus.innerHTML = '⏳ Solving...';
    }
}

// ============================================
// GAME UI
// ============================================

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

function renderCards() {
    elements.cardsContainer.innerHTML = '';
    cards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.textContent = card;
        cardDiv.addEventListener('click', () => addCardToExpression(card));
        elements.cardsContainer.appendChild(cardDiv);
    });
}

function addCardToExpression(card) {
    const current = elements.expressionInput.value;
    elements.expressionInput.value = current + card;
    elements.expressionInput.focus();
}

elements.addNumberBtn.addEventListener('click', () => {
    const current = elements.expressionInput.value;
    if (current && !/[\d]$/.test(current)) {
        // Add a random card if last char is not a number
        const randomCard = cards[Math.floor(Math.random() * cards.length)];
        elements.expressionInput.value = current + randomCard;
    }
});

function showMessage(msg, isError = false) {
    elements.gameMessage.textContent = msg;
    elements.gameMessage.className = isError ? 'message error' : 'message success';
}

// ============================================
// TIMER
// ============================================

function startTimer() {
    gameStartTime = Date.now();
    timeLeft = 60;
    
    gameTimer = setInterval(() => {
        timeLeft--;
        elements.timeLeftDisplay.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            gameTimer = null;
            handleTimeout();
        }
    }, 1000);
}

async function handleTimeout() {
    if (!gameData || gameData.status === 'completed') return;
    
    const isPlayer1 = gameData.player1 === currentUser.uid;
    const mySolution = isPlayer1 ? gameData.player1Solution : gameData.player2Solution;
    const opponentSolution = isPlayer1 ? gameData.player2Solution : gameData.player1Solution;
    
    if (opponentSolution && !mySolution) {
        // Opponent solved, I didn't
        await updateDoc(doc(db, 'games', gameId), {
            winner: isPlayer1 ? gameData.player2 : gameData.player1,
            status: 'completed'
        });
    } else if (!opponentSolution && !mySolution) {
        // Nobody solved - draw
        await updateDoc(doc(db, 'games', gameId), {
            winner: null,
            status: 'completed'
        });
    }
}

// ============================================
// SUBMIT SOLUTION
// ============================================

elements.submitBtn.addEventListener('click', submitSolution);
elements.expressionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitSolution();
});

async function submitSolution() {
    if (!gameData || !gameId) return;
    
    const expression = elements.expressionInput.value.trim();
    if (!expression) {
        showMessage('Please enter an expression!', true);
        return;
    }
    
    const evaluation = evaluateExpression(expression, cards);
    
    if (!evaluation.valid) {
        showMessage(evaluation.error, true);
        return;
    }
    
    if (Math.abs(evaluation.result - 24) > 0.0001) {
        showMessage(`Result is ${evaluation.result.toFixed(2)}, not 24!`, true);
        return;
    }
    
    // Correct solution!
    const solveTime = 60 - timeLeft;
    const isPlayer1 = gameData.player1 === currentUser.uid;
    
    const updateData = {
        [isPlayer1 ? 'player1Solution' : 'player2Solution']: expression,
        [isPlayer1 ? 'player1Time' : 'player2Time']: solveTime
    };
    
    // Check if opponent already solved
    const opponentSolution = isPlayer1 ? gameData.player2Solution : gameData.player1Solution;
    
    if (opponentSolution) {
        // Both solved, faster wins
        const opponentTime = isPlayer1 ? gameData.player2Time : gameData.player1Time;
        updateData.winner = solveTime < opponentTime ? currentUser.uid : (isPlayer1 ? gameData.player2 : gameData.player1);
        updateData.status = 'completed';
    } else {
        // First to solve wins
        updateData.winner = currentUser.uid;
        updateData.status = 'completed';
    }
    
    await updateDoc(doc(db, 'games', gameId), updateData);
    
    showMessage('Solution submitted! ✅', false);
    elements.submitBtn.disabled = true;
    elements.expressionInput.disabled = true;
}

// ============================================
// GAME END
// ============================================

async function handleGameEnd() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
    
    if (gameUnsubscribe) {
        gameUnsubscribe();
        gameUnsubscribe = null;
    }
    
    showScreen('result');
    
    const isPlayer1 = gameData.player1 === currentUser.uid;
    const opponentId = isPlayer1 ? gameData.player2 : gameData.player1;
    
    // Display solutions
    elements.yourSolution.textContent = (isPlayer1 ? gameData.player1Solution : gameData.player2Solution) || 'No solution';
    elements.opponentSolution.textContent = (isPlayer1 ? gameData.player2Solution : gameData.player1Solution) || 'No solution';
    
    const yourTime = isPlayer1 ? gameData.player1Time : gameData.player2Time;
    const opponentTime = isPlayer1 ? gameData.player2Time : gameData.player1Time;
    
    elements.yourTime.textContent = yourTime !== null ? `Time: ${yourTime}s` : '';
    elements.opponentTime.textContent = opponentTime !== null ? `Time: ${opponentTime}s` : '';
    
    // Determine result
    if (gameData.winner === currentUser.uid) {
        elements.resultTitle.textContent = '🎉 You Won!';
        
        // Calculate ELO
        const eloChange = calculateEloChange(userProfile.rating, opponent.rating);
        
        // Update database
        await updateDoc(doc(db, 'users', currentUser.uid), {
            rating: increment(eloChange.winnerChange),
            wins: increment(1),
            currentGame: null
        });
        
        await updateDoc(doc(db, 'users', opponentId), {
            rating: increment(eloChange.loserChange),
            losses: increment(1),
            currentGame: null
        });
        
        userProfile.rating += eloChange.winnerChange;
        userProfile.wins += 1;
        
        elements.ratingChange.textContent = `+${eloChange.winnerChange} Rating`;
        elements.ratingChange.className = 'rating-change positive';
        
    } else if (gameData.winner === opponentId) {
        elements.resultTitle.textContent = '😔 You Lost';
        
        // Calculate ELO
        const eloChange = calculateEloChange(opponent.rating, userProfile.rating);
        
        // Update database
        await updateDoc(doc(db, 'users', currentUser.uid), {
            rating: increment(eloChange.loserChange),
            losses: increment(1),
            currentGame: null
        });
        
        await updateDoc(doc(db, 'users', opponentId), {
            rating: increment(eloChange.winnerChange),
            wins: increment(1),
            currentGame: null
        });
        
        userProfile.rating += eloChange.loserChange;
        userProfile.losses += 1;
        
        elements.ratingChange.textContent = `${eloChange.loserChange} Rating`;
        elements.ratingChange.className = 'rating-change negative';
        
    } else {
        elements.resultTitle.textContent = '🤝 Draw';
        
        await updateDoc(doc(db, 'users', currentUser.uid), { currentGame: null });
        await updateDoc(doc(db, 'users', opponentId), { currentGame: null });
        
        elements.ratingChange.textContent = 'No rating change';
        elements.ratingChange.className = 'rating-change';
    }
    
    updateUserStatsDisplay();
    await loadLeaderboard();
    
    // Clean up
    try {
        await deleteDoc(doc(db, 'waiting', currentUser.uid));
    } catch (error) {
        // Ignore if doesn't exist
    }
}

// ============================================
// PLAY AGAIN
// ============================================

elements.playAgainBtn.addEventListener('click', () => {
    // Reset state
    gameId = null;
    gameData = null;
    opponent = null;
    cards = [];
    timeLeft = 60;
    elements.expressionInput.value = '';
    elements.expressionInput.disabled = false;
    elements.submitBtn.disabled = false;
    elements.gameMessage.textContent = '';
    
    showScreen('menu');
});
