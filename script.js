// Task Tiles Application
class TaskTiles {
    constructor() {
        this.board = document.getElementById('board');
        this.columnModal = document.getElementById('column-modal');
        this.taskModal = document.getElementById('task-modal');
        this.columns = JSON.parse(localStorage.getItem('taskTilesColumns')) || [];
        this.tasks = JSON.parse(localStorage.getItem('taskTilesTasks')) || [];
        this.currentColumnId = null;
        this.draggedTask = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadBoard();
        
        // Create default columns if none exist
        if (this.columns.length === 0) {
            this.createDefaultColumns();
        }
        
        this.renderBoard();
    }
    
    setupEventListeners() {
        // Add Column Button
        document.getElementById('add-column-btn').addEventListener('click', () => {
            this.showColumnModal();
        });
        
        // Reset Board Button
        document.getElementById('reset-board-btn').addEventListener('click', () => {
            this.resetBoard();
        });
        
        // Column Form Submit
        document.getElementById('column-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addColumn();
        });
        
        // Task Form Submit
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });
        
        // Modal Close Buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });
        
        // Modal Background Click
        [this.columnModal, this.taskModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }
    
    createDefaultColumns() {
        const defaultColumns = [
            { id: 'todo', name: 'To Do', color: '#667eea' },
            { id: 'progress', name: 'In Progress', color: '#f093fb' },
            { id: 'done', name: 'Done', color: '#4ecdc4' }
        ];
        
        defaultColumns.forEach(col => {
            this.columns.push({
                id: col.id,
                name: col.name,
                color: col.color,
                createdAt: new Date().toISOString()
            });
        });
        
        // Add some sample tasks
        const sampleTasks = [
            { id: 'task1', title: 'Design UI Components', description: 'Create wireframes and mockups for the main interface', columnId: 'todo' },
            { id: 'task2', title: 'Setup Development Environment', description: 'Install and configure all necessary tools', columnId: 'progress' },
            { id: 'task3', title: 'Create Project Structure', description: 'Set up folder structure and initial files', columnId: 'done' }
        ];
        
        sampleTasks.forEach(task => {
            this.tasks.push({
                ...task,
                createdAt: new Date().toISOString()
            });
        });
        
        this.saveToLocalStorage();
    }
    
    showColumnModal() {
        document.getElementById('column-name').value = '';
        this.columnModal.style.display = 'block';
        document.getElementById('column-name').focus();
    }
    
    showTaskModal(columnId) {
        this.currentColumnId = columnId;
        document.getElementById('task-title').value = '';
        document.getElementById('task-description').value = '';
        document.getElementById('target-column').value = columnId;
        this.taskModal.style.display = 'block';
        document.getElementById('task-title').focus();
    }
    
    addColumn() {
        const columnName = document.getElementById('column-name').value.trim();
        if (!columnName) return;
        
        const newColumn = {
            id: 'col_' + Date.now(),
            name: columnName,
            color: this.getRandomColor(),
            createdAt: new Date().toISOString()
        };
        
        this.columns.push(newColumn);
        this.saveToLocalStorage();
        this.renderBoard();
        this.columnModal.style.display = 'none';
        
        // Animate the new column
        setTimeout(() => {
            const newColumnElement = document.querySelector(`[data-column-id="${newColumn.id}"]`);
            if (newColumnElement) {
                newColumnElement.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    newColumnElement.style.transform = 'scale(1)';
                }, 200);
            }
        }, 100);
    }
    
    addTask() {
        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const columnId = this.currentColumnId;
        
        if (!title || !columnId) return;
        
        const newTask = {
            id: 'task_' + Date.now(),
            title,
            description,
            columnId,
            createdAt: new Date().toISOString()
        };
        
        this.tasks.push(newTask);
        this.saveToLocalStorage();
        this.renderBoard();
        this.taskModal.style.display = 'none';
        
        // Animate the new task
        setTimeout(() => {
            const newTaskElement = document.querySelector(`[data-task-id="${newTask.id}"]`);
            if (newTaskElement) {
                newTaskElement.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    newTaskElement.style.transform = 'scale(1)';
                }, 200);
            }
        }, 100);
    }
    
    deleteColumn(columnId) {
        if (confirm('Are you sure you want to delete this column and all its tasks?')) {
            this.columns = this.columns.filter(col => col.id !== columnId);
            this.tasks = this.tasks.filter(task => task.columnId !== columnId);
            this.saveToLocalStorage();
            this.renderBoard();
        }
    }
    
    deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.tasks = this.tasks.filter(task => task.id !== taskId);
            this.saveToLocalStorage();
            this.renderBoard();
        }
    }
    
    resetBoard() {
        if (confirm('Are you sure you want to reset the entire board? This will delete all columns and tasks.')) {
            this.columns = [];
            this.tasks = [];
            localStorage.removeItem('taskTilesColumns');
            localStorage.removeItem('taskTilesTasks');
            this.createDefaultColumns();
            this.renderBoard();
        }
    }
    
    renderBoard() {
        this.board.innerHTML = '';
        
        this.columns.forEach(column => {
            const columnElement = this.createColumnElement(column);
            this.board.appendChild(columnElement);
        });
        
        this.setupDragAndDrop();
    }
    
    createColumnElement(column) {
        const columnDiv = document.createElement('div');
        columnDiv.className = 'column';
        columnDiv.setAttribute('data-column-id', column.id);
        
        const columnTasks = this.tasks.filter(task => task.columnId === column.id);
        
        columnDiv.innerHTML = `
            <div class="column-header">
                <h3 class="column-title" style="color: ${column.color}">${column.name}</h3>
                <div class="column-controls">
                    <button class="btn btn-primary btn-small" onclick="taskTiles.showTaskModal('${column.id}')">
                        <i class="fas fa-plus"></i> Add Task
                    </button>
                    <button class="btn btn-danger btn-small" onclick="taskTiles.deleteColumn('${column.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="task-list" data-column-id="${column.id}">
                ${columnTasks.map(task => this.createTaskElement(task)).join('')}
                ${columnTasks.length === 0 ? '<div class="drop-zone">Drop tasks here or click "Add Task" to create new ones</div>' : ''}
            </div>
        `;
        
        return columnDiv;
    }
    
    createTaskElement(task) {
        return `
            <div class="task-tile" draggable="true" data-task-id="${task.id}">
                <div class="task-title">${task.title}</div>
                ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                <div class="task-actions">
                    <button class="btn btn-icon" onclick="taskTiles.deleteTask('${task.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    setupDragAndDrop() {
        // Task drag events
        document.querySelectorAll('.task-tile').forEach(task => {
            task.addEventListener('dragstart', (e) => {
                this.draggedTask = e.target;
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', e.target.outerHTML);
            });
            
            task.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
                this.draggedTask = null;
            });
        });
        
        // Column drop events
        document.querySelectorAll('.task-list').forEach(taskList => {
            taskList.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                taskList.classList.add('dragover');
            });
            
            taskList.addEventListener('dragleave', (e) => {
                if (!taskList.contains(e.relatedTarget)) {
                    taskList.classList.remove('dragover');
                }
            });
            
            taskList.addEventListener('drop', (e) => {
                e.preventDefault();
                taskList.classList.remove('dragover');
                
                if (this.draggedTask) {
                    const taskId = this.draggedTask.getAttribute('data-task-id');
                    const newColumnId = taskList.getAttribute('data-column-id');
                    
                    this.moveTask(taskId, newColumnId);
                }
            });
        });
    }
    
    moveTask(taskId, newColumnId) {
        const taskIndex = this.tasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            this.tasks[taskIndex].columnId = newColumnId;
            this.saveToLocalStorage();
            this.renderBoard();
            
            // Animate the moved task
            setTimeout(() => {
                const movedTask = document.querySelector(`[data-task-id="${taskId}"]`);
                if (movedTask) {
                    movedTask.style.transform = 'scale(1.05)';
                    movedTask.style.background = '#f0fff4';
                    setTimeout(() => {
                        movedTask.style.transform = 'scale(1)';
                        movedTask.style.background = 'white';
                    }, 500);
                }
            }, 100);
        }
    }
    
    saveToLocalStorage() {
        localStorage.setItem('taskTilesColumns', JSON.stringify(this.columns));
        localStorage.setItem('taskTilesTasks', JSON.stringify(this.tasks));
    }
    
    loadBoard() {
        // Data is loaded in constructor
        console.log('Loaded columns:', this.columns.length);
        console.log('Loaded tasks:', this.tasks.length);
    }
    
    getRandomColor() {
        const colors = [
            '#667eea', '#f093fb', '#4ecdc4', '#45b7d1', '#f9ca24', 
            '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe', '#fd79a8'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

// Initialize the application
let taskTiles;

document.addEventListener('DOMContentLoaded', () => {
    taskTiles = new TaskTiles();
    
    // Add some helpful console messages
    console.log('🎯 Task Tiles Application Loaded!');
    console.log('💡 Tips:');
    console.log('   - Drag and drop tasks between columns');
    console.log('   - Click "Add Column" to create new workflow stages');
    console.log('   - Click "Add Task" in any column to create new tasks');
    console.log('   - All data is automatically saved to your browser');
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape key closes modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
    
    // Ctrl/Cmd + N to add new column
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        taskTiles.showColumnModal();
    }
});

// Add some visual feedback for drag and drop
document.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('task-tile')) {
        document.body.style.cursor = 'grabbing';
    }
});

document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('task-tile')) {
        document.body.style.cursor = 'default';
    }
});

// Add welcome message
setTimeout(() => {
    if (localStorage.getItem('taskTilesFirstVisit') !== 'false') {
        console.log('🎉 Welcome to Task Tiles!');
        console.log('📋 This is your visual project management board.');
        console.log('🚀 Start by creating tasks or adding new columns!');
        localStorage.setItem('taskTilesFirstVisit', 'false');
    }
}, 1000); 