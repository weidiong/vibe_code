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
        this.aiContext = {
            type: 'general',
            id: null,
            data: null
        };
        this.lastAiResponse = null;
        
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
        
        // AI Assistant Event Listeners
        this.setupAIEventListeners();
        
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
    
    // AI Assistant Methods
    setupAIEventListeners() {
        // Main AI helper button in header
        document.getElementById('ai-board-helper-btn').addEventListener('click', () => {
            this.showAIAssistant('general', null, '');
        });
        
        // AI modal controls
        document.getElementById('ai-generate-btn').addEventListener('click', () => {
            this.generateAIResponse();
        });
        
        document.getElementById('ai-clear-btn').addEventListener('click', () => {
            this.clearAIPrompt();
        });
        
        document.getElementById('ai-apply-btn').addEventListener('click', () => {
            this.applyAIResponse();
        });
        
        document.getElementById('ai-regenerate-btn').addEventListener('click', () => {
            this.generateAIResponse();
        });
        
        // Board creation AI helpers
        document.getElementById('ai-board-name-btn').addEventListener('click', () => {
            this.showAIAssistant('board-name', null, 'Suggest a good name for this board');
        });
        
        document.getElementById('ai-board-desc-btn').addEventListener('click', () => {
            const boardName = document.getElementById('board-name').value;
            const context = boardName ? `for a board called "${boardName}"` : '';
            this.showAIAssistant('board-description', null, `Write a description ${context}`);
        });
        
        // Column creation AI helpers
        document.getElementById('ai-column-name-btn').addEventListener('click', () => {
            const boardContext = this.currentBoard ? ` for the "${this.currentBoard.name}" board` : '';
            this.showAIAssistant('column-name', null, `Suggest a column name${boardContext}`);
        });
        

        
        // Suggestion buttons
        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.getAttribute('data-prompt');
                document.getElementById('ai-prompt').value = prompt;
            });
        });
    }
    
    showAIAssistant(contextType, contextId = null, defaultPrompt = '') {
        this.aiContext = {
            type: contextType,
            id: contextId,
            data: this.getContextData(contextType, contextId)
        };
        
        // Update context display
        document.getElementById('ai-context-text').textContent = this.getContextDisplayText(contextType);
        document.getElementById('ai-context-type').value = contextType;
        document.getElementById('ai-context-id').value = contextId || '';
        
        // Set default prompt if provided
        if (defaultPrompt) {
            document.getElementById('ai-prompt').value = defaultPrompt;
        }
        
        // Clear previous response
        this.hideAIResponse();
        
        // Show modal
        document.getElementById('ai-assistant-modal').style.display = 'block';
        document.getElementById('ai-prompt').focus();
    }
    
    getContextDisplayText(contextType) {
        const contexts = {
            'general': 'General Assistant',
            'board-creation': 'Board Creation Helper',
            'board-name': 'Board Name Suggestions',
            'board-description': 'Board Description Helper',
            'column-name': 'Column Name Suggestions',
            'task-title': 'Task Title Suggestions',
            'task-description': 'Task Description Helper',
            'bulk-tasks': 'Bulk Task Generator'
        };
        return contexts[contextType] || 'AI Assistant';
    }
    
    getContextData(contextType, contextId) {
        const data = {
            boardName: this.currentBoard?.name,
            boardDescription: this.currentBoard?.description,
            columns: this.currentBoard?.columns || [],
            tasks: []
        };
        
        if (contextId && this.currentBoard) {
            const column = this.findColumnById(contextId);
            if (column) {
                data.currentColumn = column.name;
                data.tasks = column.tasks || [];
            }
        }
        
        return data;
    }
    
    findColumnById(columnId) {
        if (!this.currentBoard || !this.currentBoard.columns) return null;
        return this.currentBoard.columns.find(col => col.id === columnId);
    }
    
    async generateAIResponse() {
        const prompt = document.getElementById('ai-prompt').value.trim();
        if (!prompt) {
            this.showToast('Please enter a prompt first', 'warning');
            return;
        }
        
        // Show loading state
        this.showAILoading();
        
        try {
            const response = await this.callAIAPI(prompt);
            this.displayAIResponse(response);
            this.lastAiResponse = response;
            
            // Check if this is a fallback response due to rate limiting
            if (response._isFallback && response._fallbackReason === 'rate-limit') {
                this.showToast('Using smart fallback due to OpenAI rate limits - response is still intelligent!', 'info');
            }
        } catch (error) {
            console.error('AI API Error:', error);
            
            if (error.message && error.message.includes('401')) {
                this.displayAIError('Invalid API key. Please check your OpenAI API key configuration.', 'api-key');
            } else if (error.message && error.message.includes('403')) {
                this.displayAIError('API quota exceeded. Please check your OpenAI billing settings.', 'quota');
            } else {
                this.displayAIError('Failed to generate AI response. Please try again.', 'general');
            }
        }
    }
    
    async callAIAPI(prompt) {
        // Auto-detect if user wants to generate tasks or create a board
        let contextType = this.aiContext.type;
        const promptLower = prompt.toLowerCase();
        
        // If no board is selected and user wants to generate tasks, create a board with tasks
        if (!this.currentBoard && contextType === 'general' && 
            (promptLower.includes('generate') || promptLower.includes('create')) && 
            (promptLower.includes('task') || promptLower.includes('ticket') || promptLower.includes('story'))) {
            contextType = 'board-with-tasks';
        }
        // If there's a board and user wants to generate tasks, just create tasks
        else if (contextType === 'general' && 
            (promptLower.includes('generate') || promptLower.includes('create')) && 
            (promptLower.includes('task') || promptLower.includes('ticket') || promptLower.includes('story'))) {
            contextType = 'bulk-tasks';
        }
        // If no board and user wants to create a board, use board creation
        else if (!this.currentBoard && contextType === 'general' && 
            (promptLower.includes('board') || promptLower.includes('project'))) {
            contextType = 'board-creation';
        }
        
        const contextData = {
            type: contextType,
            prompt: prompt,
            context: this.aiContext.data,
            boardId: this.currentBoard?.id,
            columnId: this.aiContext.id
        };
        
        const response = await this.apiRequest('/ai/generate', {
            method: 'POST',
            body: JSON.stringify(contextData)
        });
        
        return response;
    }
    
    showAILoading() {
        const responseSection = document.getElementById('ai-response-section');
        const responseContent = document.getElementById('ai-response-content');
        
        responseContent.innerHTML = `
            <div class="ai-loading">
                <div class="ai-spinner"></div>
                <p>AI is thinking...</p>
            </div>
        `;
        
        responseSection.classList.add('visible');
    }
    
    hideAIResponse() {
        document.getElementById('ai-response-section').classList.remove('visible');
    }
    
    displayAIResponse(response) {
        const responseContent = document.getElementById('ai-response-content');
        
        if (response.type === 'board') {
            responseContent.innerHTML = this.formatBoardResponse(response);
        } else if (response.type === 'board-with-tasks') {
            responseContent.innerHTML = this.formatBoardWithTasksResponse(response);
        } else if (response.type === 'tasks') {
            responseContent.innerHTML = this.formatTasksResponse(response);
        } else if (response.type === 'text') {
            responseContent.innerHTML = this.formatTextResponse(response);
        } else {
            responseContent.innerHTML = `<p>${response.content || 'AI response received successfully.'}</p>`;
        }
    }
    
    formatBoardResponse(response) {
        return `
            <div class="ai-board-suggestion">
                <h5>${response.data.name}</h5>
                <p>${response.data.description}</p>
                <strong>Suggested Columns:</strong>
                <ul class="ai-columns-list">
                    ${response.data.columns.map(col => `<li>${col.name} - ${col.description}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    formatBoardWithTasksResponse(response) {
        const tasksHtml = response.data.tasks ? response.data.tasks.map(task => `
            <div class="ai-task-suggestion">
                <h6>${task.title}</h6>
                <p>${task.description}</p>
                <div class="ai-task-meta">
                    <span>Story Points: ${task.story_points || 'Not specified'}</span>
                    <span>Priority: ${task.priority || 'Medium'}</span>
                </div>
            </div>
        `).join('') : '';

        return `
            <div class="ai-board-suggestion">
                <h5>📋 ${response.data.name}</h5>
                <p>${response.data.description}</p>
                
                <div class="ai-board-preview">
                    <strong>🏛️ Suggested Columns:</strong>
                    <div class="ai-column-list">
                        ${response.data.columns.map(col => `<div class="ai-column-item">${col.name}</div>`).join('')}
                    </div>
                </div>
                
                ${response.data.tasks && response.data.tasks.length > 0 ? `
                    <div class="ai-task-list">
                        <strong>✅ Suggested Tasks (${response.data.tasks.length}):</strong>
                        ${tasksHtml}
                    </div>
                ` : ''}
                
                <div class="ai-board-summary">
                    <p><strong>✨ Ready to create:</strong> Complete board with ${response.data.columns.length} columns${response.data.tasks ? ` and ${response.data.tasks.length} tasks` : ''}</p>
                </div>
            </div>
        `;
    }
    
    formatTasksResponse(response) {
        return response.data.tasks.map(task => `
            <div class="ai-task-suggestion">
                <h6>${task.title}</h6>
                <p>${task.description}</p>
                <div class="ai-task-meta">
                    <span>Story Points: ${task.story_points || 'Not specified'}</span>
                    <span>Priority: ${task.priority || 'Medium'}</span>
                </div>
            </div>
        `).join('');
    }
    
    formatTextResponse(response) {
        return `<p>${response.content}</p>`;
    }
    
    displayAIError(message, errorType = 'general') {
        const responseContent = document.getElementById('ai-response-content');
        
        let icon = 'fas fa-exclamation-triangle';
        let helpText = '';
        let retryButton = '';
        
        switch (errorType) {
            case 'rate-limit':
                icon = 'fas fa-clock';
                helpText = 'OpenAI free tier allows 3 requests per minute. Please wait before trying again.';
                retryButton = '<button class="btn btn-primary btn-small" onclick="setTimeout(() => app.generateAIResponse(), 10000)">Retry in 10 seconds</button>';
                break;
            case 'api-key':
                icon = 'fas fa-key';
                helpText = 'Please check your OpenAI API key in the .env file and restart the application.';
                break;
            case 'quota':
                icon = 'fas fa-credit-card';
                helpText = 'Your OpenAI account has exceeded its usage quota. Please check your billing settings.';
                break;
            default:
                helpText = 'Please try again. If the problem persists, check your internet connection.';
                retryButton = '<button class="btn btn-primary btn-small" onclick="app.generateAIResponse()">Try Again</button>';
        }
        
        responseContent.innerHTML = `
            <div class="ai-error ai-error-${errorType}">
                <i class="${icon}"></i>
                <p><strong>${message}</strong></p>
                <small>${helpText}</small>
                ${retryButton ? `<div class="ai-error-actions">${retryButton}</div>` : ''}
            </div>
        `;
        document.getElementById('ai-response-section').classList.add('visible');
    }
    
    clearAIPrompt() {
        document.getElementById('ai-prompt').value = '';
        this.hideAIResponse();
        this.lastAiResponse = null;
    }
    
    async applyAIResponse() {
        if (!this.lastAiResponse) {
            this.showToast('No AI response to apply', 'warning');
            return;
        }
        
        try {
            await this.applyAIResponseByType(this.lastAiResponse);
            document.getElementById('ai-assistant-modal').style.display = 'none';
            this.showToast('AI suggestions applied successfully!', 'success');
        } catch (error) {
            console.error('Error applying AI response:', error);
            this.showToast('Failed to apply AI suggestions', 'error');
        }
    }
    
    async applyAIResponseByType(response) {
        switch (response.type) {
            case 'board':
                await this.applyBoardSuggestion(response.data);
                break;
            case 'board-with-tasks':
                await this.applyBoardWithTasksSuggestion(response.data);
                break;
            case 'tasks':
                await this.applyTasksSuggestion(response.data);
                break;
            case 'text':
                this.applyTextSuggestion(response.content);
                break;
            default:
                this.showToast('Unknown response type', 'warning');
        }
    }
    
    async applyBoardSuggestion(boardData) {
        // Create the board
        const boardResponse = await this.apiRequest('/boards', {
            method: 'POST',
            body: JSON.stringify({
                name: boardData.name,
                description: boardData.description
            })
        });
        
        // Create suggested columns
        if (boardData.columns && boardData.columns.length > 0) {
            for (const column of boardData.columns) {
                await this.apiRequest('/columns', {
                    method: 'POST',
                    body: JSON.stringify({
                        board_id: boardResponse.id,
                        name: column.name,
                        color: column.color || '#667eea'
                    })
                });
            }
        }
        
        await this.loadBoards();
        document.getElementById('board-select').value = boardResponse.id;
        await this.loadBoard(boardResponse.id);
    }

    async applyBoardWithTasksSuggestion(boardData) {
        try {
            // Create the board
            const boardResponse = await this.apiRequest('/boards', {
                method: 'POST',
                body: JSON.stringify({
                    name: boardData.name,
                    description: boardData.description
                })
            });
            
            // Create suggested columns
            const createdColumns = [];
            if (boardData.columns && boardData.columns.length > 0) {
                for (const column of boardData.columns) {
                    const columnResponse = await this.apiRequest('/columns', {
                        method: 'POST',
                        body: JSON.stringify({
                            board_id: boardResponse.id,
                            name: column.name,
                            color: column.color || '#667eea'
                        })
                    });
                    createdColumns.push(columnResponse);
                }
            }
            
            // Create suggested tasks
            if (boardData.tasks && boardData.tasks.length > 0) {
                let taskCount = 0;
                for (const task of boardData.tasks) {
                    // Distribute tasks across columns, or use first column if no specific column
                    const columnIndex = task.column_index || Math.floor(taskCount / Math.ceil(boardData.tasks.length / createdColumns.length));
                    const targetColumn = createdColumns[columnIndex] || createdColumns[0];
                    
                    if (targetColumn) {
                        await this.apiRequest('/tasks', {
                            method: 'POST',
                            body: JSON.stringify({
                                column_id: targetColumn.id,
                                board_id: boardResponse.id,
                                title: task.title,
                                description: task.description,
                                story_points: task.story_points
                            })
                        });
                        taskCount++;
                    }
                }
                
                this.showToast(`Created board "${boardData.name}" with ${createdColumns.length} columns and ${taskCount} tasks!`, 'success');
            } else {
                this.showToast(`Created board "${boardData.name}" with ${createdColumns.length} columns!`, 'success');
            }
            
            // Load the new board
            await this.loadBoards();
            document.getElementById('board-select').value = boardResponse.id;
            await this.loadBoard(boardResponse.id);
            
        } catch (error) {
            console.error('Error creating board with tasks:', error);
            this.showToast('Failed to create board with tasks', 'error');
        }
    }
    
    async applyTasksSuggestion(tasksData) {
        let columnId = this.aiContext.id || document.getElementById('target-column').value;
        
        // If no column is selected, use the first available column
        if (!columnId && this.currentBoard && this.currentBoard.columns && this.currentBoard.columns.length > 0) {
            columnId = this.currentBoard.columns[0].id;
            this.showToast(`No column selected, adding tasks to "${this.currentBoard.columns[0].name}"`, 'info');
        }
        
        if (!columnId) {
            this.showToast('Please create a column first or select a board with columns', 'warning');
            return;
        }
        
        if (!tasksData || !tasksData.tasks || !Array.isArray(tasksData.tasks)) {
            this.showToast('Invalid task data received from AI', 'error');
            return;
        }
        
        // Create all suggested tasks
        let createdCount = 0;
        for (const task of tasksData.tasks) {
            try {
                await this.apiRequest('/tasks', {
                    method: 'POST',
                    body: JSON.stringify({
                        column_id: columnId,
                        board_id: this.currentBoard.id,
                        title: task.title,
                        description: task.description,
                        story_points: task.story_points
                    })
                });
                createdCount++;
            } catch (error) {
                console.error('Error creating task:', error);
                this.showToast(`Failed to create task: ${task.title}`, 'error');
            }
        }
        
        if (createdCount > 0) {
            this.showToast(`Successfully created ${createdCount} task${createdCount > 1 ? 's' : ''}!`, 'success');
            await this.loadBoard(this.currentBoard.id);
            this.reapplySearchIfActive();
        }
    }
    
    applyTextSuggestion(text) {
        // Apply text to the appropriate field based on context
        switch (this.aiContext.type) {
            case 'board-name':
                document.getElementById('board-name').value = text;
                break;
            case 'board-description':
                document.getElementById('board-description').value = text;
                break;
            case 'column-name':
                document.getElementById('column-name').value = text;
                break;
            case 'task-title':
                const titleField = document.getElementById('edit-task-title') || document.getElementById('task-title');
                if (titleField) titleField.value = text;
                break;
            case 'task-description':
                const descField = document.getElementById('edit-task-description') || document.getElementById('task-description');
                if (descField) descField.value = text;
                break;
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
                <div class="drop-zone ${tasks.length > 0 ? 'with-tasks' : ''}">
                    ${tasks.length === 0 ? 'Drop tasks here or click "Add Task" to create new ones' : 'Drop tasks here'}
                </div>
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
        // Remove existing drag listeners to avoid duplicates
        document.removeEventListener('dragstart', this.handleDragStart);
        document.removeEventListener('dragend', this.handleDragEnd);
        document.removeEventListener('click', this.handleTaskButtonClick);
        
        // Use event delegation for task drag events
        this.handleDragStart = (e) => {
            const taskTile = e.target.closest('.task-tile');
            if (taskTile && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                this.draggedTask = taskTile;
                taskTile.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', taskTile.outerHTML);
                e.dataTransfer.setData('text/plain', taskTile.getAttribute('data-task-id'));
                console.log('Drag started for task:', taskTile.getAttribute('data-task-id'));
            }
        };
        
        this.handleDragEnd = (e) => {
            const taskTile = e.target.closest('.task-tile');
            if (taskTile) {
                taskTile.classList.remove('dragging');
                console.log('Drag ended for task:', taskTile.getAttribute('data-task-id'));
            }
            this.draggedTask = null;
            
            // Remove any lingering dragover classes
            document.querySelectorAll('.task-list.dragover').forEach(el => {
                el.classList.remove('dragover');
            });
        };
        
        this.handleTaskButtonClick = (e) => {
            const button = e.target.closest('[data-action]');
            if (button) {
                e.stopPropagation();
                e.preventDefault();
                
                const action = button.getAttribute('data-action');
                const taskId = button.getAttribute('data-task-id');
                
                if (action === 'edit-task') {
                    this.showEditTaskModal(taskId);
                } else if (action === 'delete-task') {
                    this.deleteTask(taskId);
                }
            }
        };
        
        // Attach event listeners with delegation
        document.addEventListener('dragstart', this.handleDragStart.bind(this));
        document.addEventListener('dragend', this.handleDragEnd.bind(this));
        document.addEventListener('click', this.handleTaskButtonClick.bind(this));
        
        // Column drop events - handle both task-list and drop-zone
        document.querySelectorAll('.task-list, .drop-zone').forEach(dropTarget => {
            dropTarget.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                // Add visual feedback to the appropriate container
                const taskList = dropTarget.classList.contains('task-list') ? dropTarget : dropTarget.closest('.task-list');
                if (taskList) {
                    taskList.classList.add('dragover');
                }
            });
            
            dropTarget.addEventListener('dragleave', (e) => {
                const taskList = dropTarget.classList.contains('task-list') ? dropTarget : dropTarget.closest('.task-list');
                if (taskList && !taskList.contains(e.relatedTarget)) {
                    taskList.classList.remove('dragover');
                }
            });
            
            dropTarget.addEventListener('drop', (e) => {
                e.preventDefault();
                
                // Remove visual feedback
                const taskList = dropTarget.classList.contains('task-list') ? dropTarget : dropTarget.closest('.task-list');
                if (taskList) {
                    taskList.classList.remove('dragover');
                }
                
                if (this.draggedTask) {
                    const taskId = this.draggedTask.getAttribute('data-task-id');
                    const newColumnId = taskList ? taskList.getAttribute('data-column-id') : null;
                    
                    if (newColumnId) {
                        this.moveTask(taskId, newColumnId);
                    }
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