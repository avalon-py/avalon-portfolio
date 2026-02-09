// Windows 95 Portfolio Scripts

document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    
    // Initial State: Open Explanation
    openWindow('explanation');
});

// Clock Logic
function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    document.getElementById('clock').innerText = `${hours}:${minutes} ${ampm}`;
}

// Window Management
let zIndexCounter = 20;

window.openWindow = function(windowName) {
    const win = document.getElementById(`window-${windowName}`);
    const taskbarItem = document.getElementById(`taskbar-${windowName}`);
    
    if (win) {
        win.classList.remove('hidden');
        bringToFront(`window-${windowName}`);
    }
    
    // Simple visual update for taskbar (pressed vs unpressed)
    if (taskbarItem) {
        taskbarItem.classList.remove('hidden'); // Ensure visible
        document.querySelectorAll('[id^="taskbar-"]').forEach(el => {
            el.classList.remove('win95-btn-inset');
            el.classList.add('win95-btn');
            el.style.backgroundColor = '#c0c0c0';
        });
        taskbarItem.classList.remove('win95-btn');
        taskbarItem.classList.add('win95-btn-inset');
        taskbarItem.style.backgroundColor = '#e0e0e0';
    }
};

window.closeWindow = function(windowId) {
    const win = document.getElementById(windowId);
    if (win) {
        win.classList.add('hidden');
        
        // Update taskbar to look "closed" or just unpressed
        const name = windowId.replace('window-', '');
        const taskbarItem = document.getElementById(`taskbar-${name}`);
        if(taskbarItem) {
            taskbarItem.classList.remove('win95-btn-inset');
            taskbarItem.classList.add('win95-btn');
            taskbarItem.style.backgroundColor = '#c0c0c0';
        }
    }
};

window.minimizeWindow = function(windowId) {
    // For now, same as close but conceptually just hiding it
    window.closeWindow(windowId);
};

window.bringToFront = function(windowId) {
    zIndexCounter++;
    const win = document.getElementById(windowId);
    if (win) {
        win.style.zIndex = zIndexCounter;
    }
    
    // Update active taskbar state
    const name = windowId.replace('window-', '');
    document.querySelectorAll('[id^="taskbar-"]').forEach(el => {
        el.classList.remove('win95-btn-inset');
        el.classList.add('win95-btn');
        el.style.backgroundColor = '#c0c0c0';
    });
    const taskbarItem = document.getElementById(`taskbar-${name}`);
    if(taskbarItem) {
        taskbarItem.classList.remove('win95-btn');
        taskbarItem.classList.add('win95-btn-inset');
        taskbarItem.style.backgroundColor = '#e0e0e0';
    }
};

// Tab Switching Logic (Explanation Window)
window.switchTab = function(tabName) {
    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('block');
    });
    
    // Show selected content
    const selectedContent = document.getElementById(`tab-${tabName}`);
    if (selectedContent) {
        selectedContent.classList.remove('hidden');
        selectedContent.classList.add('block');
    }

    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find the button that called this
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if(btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });
};

// Simulation Logic (Explanation Window)
const runBtn = document.getElementById('runSimBtn');
const terminal = document.getElementById('terminal-output');
const nodeUser = document.getElementById('node-user');
const nodeServer = document.getElementById('node-server');
const nodeDb = document.getElementById('node-db');
const packet1 = document.getElementById('packet-1');
const packet2 = document.getElementById('packet-2');
const tableBody = document.getElementById('db-table-body');

let isSimulating = false;

if (runBtn) {
    runBtn.addEventListener('click', () => {
        if (isSimulating) return;
        isSimulating = true;
        
        // Reset visual state
        terminal.innerHTML = '<span class="blink">_</span>';
        
        // Sequence
        logTerminal('User sends: - 25k Entertainment -Spotify');
        
        setTimeout(() => {
            // Step 1: User -> Server
            nodeUser.classList.add('bg-yellow-200');
            packet1.style.display = 'block';
            packet1.style.left = '0';
            packet1.classList.remove('hidden');
            
            // Animate Packet 1
            let pos = 0;
            const interval1 = setInterval(() => {
                pos += 5;
                packet1.style.left = pos + '%';
                if (pos >= 95) {
                    clearInterval(interval1);
                    packet1.classList.add('hidden');
                    serverProcess();
                }
            }, 20);
            
        }, 500);
    });
}

function logTerminal(text) {
    const line = document.createElement('div');
    line.innerText = `> ${text}`;
    terminal.insertBefore(line, terminal.lastElementChild);
    // Keep max 5 lines
    while (terminal.children.length > 6) {
        terminal.removeChild(terminal.firstChild);
    }
}

function serverProcess() {
    logTerminal('Server: Parsing command...');
    nodeServer.classList.add('bg-blue-200');
    nodeUser.classList.remove('bg-yellow-200');
    
    setTimeout(() => {
        logTerminal('Server: Connecting to Firestore...');
        
        // Step 2: Server -> DB
        packet2.style.display = 'block';
        packet2.style.left = '0';
        packet2.classList.remove('hidden');
        
        let pos = 0;
        const interval = setInterval(() => {
            pos += 5;
            packet2.style.left = pos + '%';
            if (pos >= 95) {
                clearInterval(interval);
                packet2.classList.add('hidden');
                dbSave();
            }
        }, 20);
        
    }, 800);
}

function dbSave() {
    logTerminal('Firestore: Document created.');
    nodeServer.classList.remove('bg-blue-200');
    nodeDb.classList.add('bg-green-200');
    
    setTimeout(() => {
        // Add row to table
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td class="p-1 font-bold">002</td>
            <td class="p-1 font-bold">Entertainment</td>
            <td class="p-1 font-bold">-Rp25.000</td>
            <td class="p-1 font-bold text-green-600">Spotify</td>
        `;
        tableBody.insertBefore(newRow, tableBody.firstChild);
        
        logTerminal('Success. 200 OK.');
        
        setTimeout(() => {
            nodeDb.classList.remove('bg-green-200');
            isSimulating = false;
        }, 1000);
        
    }, 500);
}