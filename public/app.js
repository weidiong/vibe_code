// Task Tiles Full Stack Application
class TaskTilesApp {
    constructor() {
        this.apiUrl = window.location.origin + '/api';
        this.currentBoard = null;
        this.boards = [];
        this.draggedTask = null;
        this.isConnected = true;
        this.searchTerm = '';
        this.allTasks = [];
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        await this.loadBoards();
        this.hideLoading();
    }
    
    setupEventListeners() {
        // Board selector
        document.getElementById('board-select').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadBoard(e.target.value);
            } else {
                this.currentBoard = null;
                this.showEmptyState();
            }
        });
        
        // Create board button
        document.getElementById('create-board-btn').addEventListener('click', () => {
            this.showBoardModal();
        });
        
        // Add Column Button
        document.getElementById('add-column-btn').addEventListener('click', () => {
            if (!this.currentBoard) {
                this.showToast('Please select a board first', 'warning');
                return;
            }
            this.showColumnModal();
        });
        
        // Reset Board Button
        document.getElementById('reset-board-btn').addEventListener('click', () => {
            this.resetBoard();
        });
        
        // Column preset selector
        document.getElementById('column-preset').addEventListener('change', (e) => {
            if (e.target.value) {
                document.getElementById('column-name').value = e.target.value;
            }
        });
        
        // Color swatch selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-swatch')) {
                // Remove selected class from all swatches
                document.querySelectorAll('.color-swatch').forEach(swatch => {
                    swatch.classList.remove('selected');
                });
                
                // Add selected class to clicked swatch
                e.target.classList.add('selected');
                
                // Update hidden color input
                document.getElementById('column-color').value = e.target.dataset.color;
            }
        });
        
        // Board Form Submit
        document.getElementById('board-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createBoard();
        });
        
        // Column Form Submit
        document.getElementById('column-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createColumn();
        });
        
        // Task Form Submit
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTask();
        });
        
        // Edit Task Form Submit
        document.getElementById('edit-task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateTask();
        });
        
        // Modal Close Buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });
        
        // Modal Background Click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        // Search functionality
        const searchInput = document.getElementById('task-search');
        const clearSearchBtn = document.getElementById('clear-search');
        
        searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.trim();
            this.performSearch();
            this.updateClearButtonVisibility();
        });
        
        clearSearchBtn.addEventListener('click', () => {
            this.clearSearch();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close modals first
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
                
                // Clear search if it's active
                if (this.searchTerm) {
                    this.clearSearch();
                }
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (this.currentBoard) {
                    this.showColumnModal();
                }
            }
            
            // Focus search with Ctrl+F or Cmd+F
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        });
    }
    
    async apiRequest(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.setConnectionStatus(true);
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            this.setConnectionStatus(false);
            throw error;
        }
    }
    
    setConnectionStatus(connected) {
        // Connection status display removed per user feedback
        this.isConnected = connected;
    }
    
    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.getElementById('toast-container').appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    
    // Search functionality methods
    performSearch() {
        if (!this.currentBoard || !this.currentBoard.columns) {
            this.updateSearchResultsCount(0, 0);
            return;
        }
        
        const searchTerm = this.searchTerm.toLowerCase();
        let totalMatches = 0;
        let totalTasks = 0;
        
        // If no search term, show all tasks
        if (!searchTerm) {
            document.querySelectorAll('.task-tile').forEach(task => {
                task.classList.remove('search-hidden');
                this.removeSearchHighlights(task);
            });
            this.updateSearchResultsCount(0, 0);
            this.updateTaskCounters();
            return;
        }
        
        // Search through all tasks
        document.querySelectorAll('.task-tile').forEach(taskElement => {
            totalTasks++;
            const taskId = taskElement.getAttribute('data-task-id');
            const task = this.findTaskById(taskId);
            
            if (task && this.matchesSearchTerm(task, searchTerm)) {
                taskElement.classList.remove('search-hidden');
                this.highlightSearchMatches(taskElement, task, searchTerm);
                totalMatches++;
            } else {
                taskElement.classList.add('search-hidden');
                this.removeSearchHighlights(taskElement);
            }
        });
        
        this.updateSearchResultsCount(totalMatches, totalTasks);
        this.updateTaskCounters();
    }
    
    matchesSearchTerm(task, searchTerm) {
        // Search in task title
        if (task.title && task.title.toLowerCase().includes(searchTerm)) {
            return true;
        }
        
        // Search in task description
        if (task.description && task.description.toLowerCase().includes(searchTerm)) {
            return true;
        }
        
        // Search in story points
        if (task.story_points && task.story_points.toString().includes(searchTerm)) {
            return true;
        }
        
        return false;
    }
    
    highlightSearchMatches(taskElement, task, searchTerm) {
        // Remove existing highlights
        this.removeSearchHighlights(taskElement);
        
        // Highlight title matches
        const titleElement = taskElement.querySelector('.task-title');
        if (titleElement && task.title && task.title.toLowerCase().includes(searchTerm)) {
            titleElement.innerHTML = this.highlightText(task.title, searchTerm);
        }
        
        // Highlight description matches
        const descElement = taskElement.querySelector('.task-description');
        if (descElement && task.description && task.description.toLowerCase().includes(searchTerm)) {
            descElement.innerHTML = this.highlightText(task.description, searchTerm);
        }
    }
    
    highlightText(text, searchTerm) {
        if (!text || !searchTerm) return text;
        
        const regex = new RegExp(`(${this.escapeRegExp(searchTerm)})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }
    
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    removeSearchHighlights(taskElement) {
        const highlightedElements = taskElement.querySelectorAll('.search-highlight');
        highlightedElements.forEach(element => {
            element.outerHTML = element.innerHTML;
        });
    }
    
    findTaskById(taskId) {
        if (!this.currentBoard || !this.currentBoard.columns) return null;
        
        for (const column of this.currentBoard.columns) {
            const task = column.tasks.find(t => t.id === taskId);
            if (task) return task;
        }
        return null;
    }
    
    updateSearchResultsCount(matches, total) {
        const countElement = document.getElementById('search-results-count');
        if (matches === 0 && total === 0) {
            countElement.textContent = '';
        } else if (matches === total) {
            countElement.textContent = `Showing all ${total} tasks`;
        } else {
            countElement.textContent = `Found ${matches} of ${total} tasks`;
        }
    }
    
    updateTaskCounters() {
        // Update task counters for each column based on visible tasks
        document.querySelectorAll('.column').forEach(columnElement => {
            const taskList = columnElement.querySelector('.task-list');
            const visibleTasks = taskList.querySelectorAll('.task-tile:not(.search-hidden)');
            const counter = columnElement.querySelector('.task-counter');
            if (counter) {
                counter.textContent = visibleTasks.length;
            }
        });
    }
    
    clearSearch() {
        document.getElementById('task-search').value = '';
        this.searchTerm = '';
        this.performSearch();
        this.updateClearButtonVisibility();
    }
    
    updateClearButtonVisibility() {
        const clearBtn = document.getElementById('clear-search');
        if (this.searchTerm) {
            clearBtn.classList.add('visible');
        } else {
            clearBtn.classList.remove('visible');
        }
    }
    
    showSearchContainer() {
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.classList.add('visible');
        }
    }
    
    hideSearchContainer() {
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.classList.remove('visible');
            // Clear search when hiding
            this.clearSearch();
        }
    }
    
    // Helper method to reapply search after board updates
    reapplySearchIfActive() {
        if (this.searchTerm) {
            document.getElementById('task-search').value = this.searchTerm;
            setTimeout(() => {
                this.performSearch();
                this.updateClearButtonVisibility();
            }, 100); // Small delay to ensure DOM is updated
        }
    }
    
    async loadBoards() {
        try {
            this.showLoading();
            this.boards = await this.apiRequest('/boards');
            this.updateBoardSelector();
        } catch (error) {
            this.showToast('Failed to load boards', 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    updateBoardSelector() {
        const select = document.getElementById('board-select');
        select.innerHTML = '<option value="">Select a board...</option>';
        
        this.boards.forEach(board => {
            const option = document.createElement('option');
            option.value = board.id;
            option.textContent = board.name;
            select.appendChild(option);
        });
    }
    
    async loadBoard(boardId) {
        try {
            this.showLoading();
            this.currentBoard = await this.apiRequest(`/boards/${boardId}`);
            this.renderBoard();
        } catch (error) {
            this.showToast('Failed to load board', 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    showEmptyState() {
        const board = document.getElementById('board');
        board.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>Select a board to get started</h3>
                <p>Choose a board from the dropdown above or create a new one</p>
            </div>
        `;
        this.hideSearchContainer();
    }
    
    renderBoard() {
        const board = document.getElementById('board');
        board.innerHTML = '';
        
        // Clear search when switching boards
        this.clearSearch();
        
        if (!this.currentBoard || !this.currentBoard.columns) {
            this.showEmptyState();
            return;
        }
        
        // Show search container since we have a board loaded
        this.showSearchContainer();
        
        this.currentBoard.columns.forEach(column => {
            const columnElement = this.createColumnElement(column);
            board.appendChild(columnElement);
        });
        
        this.setupDragAndDrop();
        
        // Initialize search state for the new board
        this.updateSearchResultsCount(0, 0);
    }
    
    createColumnElement(column) {
        const columnDiv = document.createElement('div');
        columnDiv.className = 'column';
        columnDiv.setAttribute('data-column-id', column.id);
        
        const tasks = column.tasks || [];
        const taskCount = tasks.length;
        
        columnDiv.innerHTML = `
            <div class="column-header">
                <div class="column-title-section">
                    <h3 class="column-title" style="color: ${column.color}">${column.name}</h3>
                    <span class="task-counter">${taskCount}</span>
                </div>
                <div class="column-controls">
                    <button class="btn btn-primary btn-small" data-action="add-task" data-column-id="${column.id}">
                        <i class="fas fa-plus"></i> Add Task
                    </button>
                    <button class="btn btn-danger btn-small" data-action="delete-column" data-column-id="${column.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="task-list" data-column-id="${column.id}">
                ${tasks.map(task => this.createTaskElement(task)).join('')}
                ${tasks.length === 0 ? '<div class="drop-zone">Drop tasks here or click "Add Task" to create new ones</div>' : ''}
            </div>
        `;
        
        // Add event listeners to buttons
        columnDiv.querySelector('[data-action="add-task"]').addEventListener('click', () => {
            this.showTaskModal(column.id);
        });
        
        columnDiv.querySelector('[data-action="delete-column"]').addEventListener('click', () => {
            this.deleteColumn(column.id);
        });
        
        return columnDiv;
    }
    
    createTaskElement(task) {
        return `
            <div class="task-tile" draggable="true" data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-title">${task.title}</div>
                    ${task.story_points ? `<div class="story-points">${task.story_points}</div>` : ''}
                </div>
                ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                <div class="task-actions">
                    <button class="btn btn-icon btn-warning" data-action="edit-task" data-task-id="${task.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-icon btn-danger" data-action="delete-task" data-task-id="${task.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    setupDragAndDrop() {
        // Task drag events
        document.querySelectorAll('.task-tile').forEach(task => {
            // Add click event listeners for edit/delete buttons
            const editBtn = task.querySelector('[data-action="edit-task"]');
            const deleteBtn = task.querySelector('[data-action="delete-task"]');
            
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showEditTaskModal(editBtn.dataset.taskId);
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteTask(deleteBtn.dataset.taskId);
                });
            }
            
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
    
    // Modal functions
    showBoardModal() {
        document.getElementById('board-name').value = '';
        document.getElementById('board-description').value = '';
        document.getElementById('board-modal').style.display = 'block';
        document.getElementById('board-name').focus();
    }
    
    showColumnModal() {
        document.getElementById('column-preset').value = '';
        document.getElementById('column-name').value = '';
        document.getElementById('column-color').value = '#667eea';
        
        // Reset color swatch selection
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.classList.remove('selected');
        });
        
        // Select the first color swatch by default
        const firstSwatch = document.querySelector('.color-swatch');
        if (firstSwatch) {
            firstSwatch.classList.add('selected');
        }
        
        document.getElementById('column-modal').style.display = 'block';
        document.getElementById('column-name').focus();
    }
    
    showTaskModal(columnId) {
        document.getElementById('task-title').value = '';
        document.getElementById('task-description').value = '';
        document.getElementById('task-story-points').value = '';
        document.getElementById('target-column').value = columnId;
        document.getElementById('task-modal').style.display = 'block';
        document.getElementById('task-title').focus();
    }
    
    showEditTaskModal(taskId) {
        // Find the task in the current board
        let task = null;
        for (const column of this.currentBoard.columns) {
            task = column.tasks.find(t => t.id === taskId);
            if (task) break;
        }
        
        if (!task) {
            this.showToast('Task not found', 'error');
            return;
        }
        
        document.getElementById('edit-task-title').value = task.title;
        document.getElementById('edit-task-description').value = task.description || '';
        document.getElementById('edit-task-story-points').value = task.story_points || '';
        document.getElementById('edit-task-id').value = taskId;
        document.getElementById('edit-task-modal').style.display = 'block';
        document.getElementById('edit-task-title').focus();
    }
    
    // API operations
    async createBoard() {
        try {
            const name = document.getElementById('board-name').value.trim();
            const description = document.getElementById('board-description').value.trim();
            
            if (!name) {
                this.showToast('Board name is required', 'warning');
                return;
            }
            
            await this.apiRequest('/boards', {
                method: 'POST',
                body: JSON.stringify({ name, description })
            });
            
            document.getElementById('board-modal').style.display = 'none';
            this.showToast('Board created successfully', 'success');
            await this.loadBoards();
        } catch (error) {
            this.showToast('Failed to create board', 'error');
        }
    }
    
    async createColumn() {
        try {
            const name = document.getElementById('column-name').value.trim();
            const color = document.getElementById('column-color').value;
            
            if (!name) {
                this.showToast('Column name is required', 'warning');
                return;
            }
            
            if (!this.currentBoard) {
                this.showToast('Please select a board first', 'warning');
                return;
            }
            
            await this.apiRequest('/columns', {
                method: 'POST',
                body: JSON.stringify({
                    board_id: this.currentBoard.id,
                    name,
                    color
                })
            });
            
            document.getElementById('column-modal').style.display = 'none';
            this.showToast('Column created successfully', 'success');
            await this.loadBoard(this.currentBoard.id);
        } catch (error) {
            this.showToast('Failed to create column', 'error');
        }
    }
    
    async createTask() {
        try {
            const title = document.getElementById('task-title').value.trim();
            const description = document.getElementById('task-description').value.trim();
            const storyPoints = document.getElementById('task-story-points').value;
            const columnId = document.getElementById('target-column').value;
            
            if (!title) {
                this.showToast('Task title is required', 'warning');
                return;
            }
            
            if (!columnId || !this.currentBoard) {
                this.showToast('Please select a column', 'warning');
                return;
            }
            
            const taskData = {
                column_id: columnId,
                board_id: this.currentBoard.id,
                title,
                description
            };
            
            if (storyPoints && parseInt(storyPoints) > 0) {
                taskData.story_points = parseInt(storyPoints);
            }
            
            await this.apiRequest('/tasks', {
                method: 'POST',
                body: JSON.stringify(taskData)
            });
            
            document.getElementById('task-modal').style.display = 'none';
            this.showToast('Task created successfully', 'success');
            await this.loadBoard(this.currentBoard.id);
            this.reapplySearchIfActive();
        } catch (error) {
            this.showToast('Failed to create task', 'error');
        }
    }
    
    async updateTask() {
        try {
            const title = document.getElementById('edit-task-title').value.trim();
            const description = document.getElementById('edit-task-description').value.trim();
            const storyPoints = document.getElementById('edit-task-story-points').value;
            const taskId = document.getElementById('edit-task-id').value;
            
            if (!title) {
                this.showToast('Task title is required', 'warning');
                return;
            }
            
            const updateData = { title, description };
            
            if (storyPoints !== '') {
                updateData.story_points = storyPoints ? parseInt(storyPoints) : null;
            }
            
            await this.apiRequest(`/tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            document.getElementById('edit-task-modal').style.display = 'none';
            this.showToast('Task updated successfully', 'success');
            await this.loadBoard(this.currentBoard.id);
            this.reapplySearchIfActive();
        } catch (error) {
            this.showToast('Failed to update task', 'error');
        }
    }
    
    async moveTask(taskId, newColumnId) {
        try {
            await this.apiRequest(`/tasks/${taskId}/move`, {
                method: 'PUT',
                body: JSON.stringify({ column_id: newColumnId })
            });
            
            this.showToast('Task moved successfully', 'success');
            await this.loadBoard(this.currentBoard.id);
            this.reapplySearchIfActive();
        } catch (error) {
            this.showToast('Failed to move task', 'error');
        }
    }
    
    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;
        
        try {
            await this.apiRequest(`/tasks/${taskId}`, {
                method: 'DELETE'
            });
            
            this.showToast('Task deleted successfully', 'success');
            await this.loadBoard(this.currentBoard.id);
            this.reapplySearchIfActive();
        } catch (error) {
            this.showToast('Failed to delete task', 'error');
        }
    }
    
    async deleteColumn(columnId) {
        if (!confirm('Are you sure you want to delete this column and all its tasks?')) return;
        
        try {
            await this.apiRequest(`/columns/${columnId}`, {
                method: 'DELETE'
            });
            
            this.showToast('Column deleted successfully', 'success');
            await this.loadBoard(this.currentBoard.id);
        } catch (error) {
            this.showToast('Failed to delete column', 'error');
        }
    }
    
    async resetBoard() {
        if (!this.currentBoard) {
            this.showToast('Please select a board first', 'warning');
            return;
        }
        
        if (!confirm('Are you sure you want to delete this entire board? This action cannot be undone.')) return;
        
        try {
            await this.apiRequest(`/boards/${this.currentBoard.id}`, {
                method: 'DELETE'
            });
            
            this.showToast('Board deleted successfully', 'success');
            this.currentBoard = null;
            document.getElementById('board-select').value = '';
            this.showEmptyState();
            await this.loadBoards();
        } catch (error) {
            this.showToast('Failed to delete board', 'error');
        }
    }
}

// Initialize the application
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new TaskTilesApp();
    
    console.log('🚀 Task Tiles Full Stack Application Loaded!');
    console.log('💾 Connected to PostgreSQL Database');
    console.log('🌐 API Backend Active');
    console.log('💡 Features:');
    console.log('   - Real-time database persistence');
    console.log('   - Multiple board support');
    console.log('   - Full CRUD operations');
    console.log('   - Drag and drop functionality');
    console.log('   - RESTful API architecture');
});

// Handle connection errors gracefully
window.addEventListener('online', () => {
    console.log('🌐 Connection restored');
    if (app) {
        app.setConnectionStatus(true);
        app.showToast('Connection restored', 'success');
    }
});

window.addEventListener('offline', () => {
    console.log('❌ Connection lost');
    if (app) {
        app.setConnectionStatus(false);
        app.showToast('Connection lost', 'warning');
    }
}); 