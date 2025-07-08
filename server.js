const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const path = require('path');
require('dotenv').config();

const pool = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// API Routes

// Get all boards
app.get('/api/boards', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM boards ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// Get board by ID with columns and tasks
app.get('/api/boards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get board
    const boardResult = await pool.query('SELECT * FROM boards WHERE id = $1', [id]);
    if (boardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Get columns
    const columnsResult = await pool.query(
      'SELECT * FROM columns WHERE board_id = $1 ORDER BY position',
      [id]
    );
    
    // Get tasks for each column
    const tasksResult = await pool.query(
      'SELECT * FROM tasks WHERE board_id = $1 ORDER BY position',
      [id]
    );
    
    const board = boardResult.rows[0];
    const columns = columnsResult.rows;
    const tasks = tasksResult.rows;
    
    // Group tasks by column
    const columnsWithTasks = columns.map(column => ({
      ...column,
      tasks: tasks.filter(task => task.column_id === column.id)
    }));
    
    res.json({
      ...board,
      columns: columnsWithTasks
    });
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

// Create new board
app.post('/api/boards', [
  body('name').trim().notEmpty().withMessage('Board name is required'),
  body('description').optional().trim()
], handleValidationErrors, async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      'INSERT INTO boards (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating board:', error);
    res.status(500).json({ error: 'Failed to create board' });
  }
});

// Create new column
app.post('/api/columns', [
  body('board_id').isUUID().withMessage('Valid board ID is required'),
  body('name').trim().notEmpty().withMessage('Column name is required'),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Invalid color format'),
  body('position').optional().isInt({ min: 0 }).withMessage('Position must be a non-negative integer')
], handleValidationErrors, async (req, res) => {
  try {
    const { board_id, name, color, position } = req.body;
    
    // Get next position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const positionResult = await pool.query(
        'SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM columns WHERE board_id = $1',
        [board_id]
      );
      finalPosition = positionResult.rows[0].next_position;
    }
    
    const result = await pool.query(
      'INSERT INTO columns (board_id, name, color, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [board_id, name, color || '#667eea', finalPosition]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating column:', error);
    res.status(500).json({ error: 'Failed to create column' });
  }
});

// Create new task
app.post('/api/tasks', [
  body('column_id').isUUID().withMessage('Valid column ID is required'),
  body('board_id').isUUID().withMessage('Valid board ID is required'),
  body('title').trim().notEmpty().withMessage('Task title is required'),
  body('description').optional().trim(),
  body('story_points').optional().isInt({ min: 0, max: 100 }).withMessage('Story points must be between 0 and 100'),
  body('position').optional().isInt({ min: 0 }).withMessage('Position must be a non-negative integer')
], handleValidationErrors, async (req, res) => {
  try {
    const { column_id, board_id, title, description, story_points, position } = req.body;
    
    // Get next position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const positionResult = await pool.query(
        'SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM tasks WHERE column_id = $1',
        [column_id]
      );
      finalPosition = positionResult.rows[0].next_position;
    }
    
    const result = await pool.query(
      'INSERT INTO tasks (column_id, board_id, title, description, story_points, position) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [column_id, board_id, title, description, story_points, finalPosition]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Move task to different column
app.put('/api/tasks/:id/move', [
  body('column_id').isUUID().withMessage('Valid column ID is required'),
  body('position').optional().isInt({ min: 0 }).withMessage('Position must be a non-negative integer')
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { column_id, position } = req.body;
    
    // Get next position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const positionResult = await pool.query(
        'SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM tasks WHERE column_id = $1',
        [column_id]
      );
      finalPosition = positionResult.rows[0].next_position;
    }
    
    const result = await pool.query(
      'UPDATE tasks SET column_id = $1, position = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [column_id, finalPosition, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error moving task:', error);
    res.status(500).json({ error: 'Failed to move task' });
  }
});

// Update task
app.put('/api/tasks/:id', [
  body('title').optional().trim().notEmpty().withMessage('Task title cannot be empty'),
  body('description').optional().trim(),
  body('story_points').optional().isInt({ min: 0, max: 100 }).withMessage('Story points must be between 0 and 100')
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, story_points } = req.body;
    
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updateFields.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
    }
    
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }
    
    if (story_points !== undefined) {
      updateFields.push(`story_points = $${paramCount}`);
      values.push(story_points);
      paramCount++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const result = await pool.query(
      `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Delete column
app.delete('/api/columns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM columns WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Column not found' });
    }
    
    res.json({ message: 'Column deleted successfully' });
  } catch (error) {
    console.error('Error deleting column:', error);
    res.status(500).json({ error: 'Failed to delete column' });
  }
});

// Delete board
app.delete('/api/boards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM boards WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    res.json({ message: 'Board deleted successfully' });
  } catch (error) {
    console.error('Error deleting board:', error);
    res.status(500).json({ error: 'Failed to delete board' });
  }
  });

// AI Assistant endpoint
app.post('/api/ai/generate', [
  body('type').trim().notEmpty().withMessage('AI context type is required'),
  body('prompt').trim().notEmpty().withMessage('Prompt is required'),
  body('context').optional().isObject().withMessage('Context must be an object')
], handleValidationErrors, async (req, res) => {
  try {
    const { type, prompt, context, boardId, columnId } = req.body;
    
    // Check if AI API key is configured (support both OpenAI and Gemini)
    const openAIKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!openAIKey && !geminiKey) {
      return res.status(503).json({ 
        error: 'AI API key not configured',
        message: 'Please set either OPENAI_API_KEY or GEMINI_API_KEY environment variable to enable AI features.'
      });
    }
    
    // Call appropriate AI API
    const response = geminiKey ? await callGemini(type, prompt, context) : await callOpenAI(type, prompt, context);
    
    res.json(response);
  } catch (error) {
    console.error('Error generating AI response:', error);
    
    // Handle rate limiting errors
    if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many AI requests. Please wait a moment and try again.'
      });
    }
    
    // Handle invalid API key errors
    if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('Invalid API key')) {
      return res.status(401).json({ 
        error: 'Invalid AI API key',
        message: 'Please check your AI API key configuration.'
      });
    }
    
    // Handle quota exceeded errors
    if (error.message.includes('403') || error.message.includes('quota')) {
      return res.status(403).json({ 
        error: 'API quota exceeded',
        message: 'AI API quota exceeded. Please check your billing settings.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate AI response',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
// Function to call Gemini AI API
async function callGemini(type, prompt, context) {
  try {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!geminiKey) {
      throw new Error('Gemini API key not configured');
    }

    const systemPrompt = getSystemPrompt(type);
    const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}`;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No content in Gemini response');
    }

    // Try to parse as JSON for structured responses
    if (type === 'bulk-tasks' || type === 'board-creation' || type === 'board-with-tasks') {
      try {
        const jsonResponse = JSON.parse(content);
        
        // Ensure the response has the correct structure for bulk tasks
        if (type === 'bulk-tasks') {
          // If the AI returned a direct tasks array, wrap it properly
          if (Array.isArray(jsonResponse)) {
            return {
              type: 'tasks',
              data: {
                tasks: jsonResponse
              }
            };
          }
          // If it's already properly structured, return as is
          if (jsonResponse.type === 'tasks' && jsonResponse.data && jsonResponse.data.tasks) {
            return jsonResponse;
          }
          // If it has tasks but wrong structure, fix it
          if (jsonResponse.tasks) {
            return {
              type: 'tasks',
              data: {
                tasks: jsonResponse.tasks
              }
            };
          }
        }
        
        // Ensure the response has the correct structure for board-with-tasks
        if (type === 'board-with-tasks') {
          // If it's already properly structured, return as is
          if (jsonResponse.type === 'board-with-tasks' && jsonResponse.data) {
            return jsonResponse;
          }
          // If it has the data but wrong structure, fix it
          if (jsonResponse.name && jsonResponse.columns) {
            return {
              type: 'board-with-tasks',
              data: {
                name: jsonResponse.name,
                description: jsonResponse.description || '',
                columns: jsonResponse.columns || [],
                tasks: jsonResponse.tasks || []
              }
            };
          }
        }
        
        return jsonResponse;
      } catch (e) {
        // If JSON parsing fails, use intelligent fallback for task types
        if (type === 'bulk-tasks') {
          return getIntelligentFallback(prompt, context);
        }
        if (type === 'board-with-tasks') {
          return getBoardWithTasksFallback(prompt, context);
        }
        throw e;
      }
    }

    // For non-structured responses, return as text
    // But if it's a bulk-tasks request, try to parse natural language into tasks
    if (type === 'bulk-tasks') {
      return parseNaturalLanguageIntoTasks(content, context);
    }
    
    // If it's a board-with-tasks request, try to parse natural language into board
    if (type === 'board-with-tasks') {
      return parseNaturalLanguageIntoBoard(content, context);
    }
    
    return {
      type: 'text',
      content: content.trim()
    };

  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Handle rate limiting gracefully
    if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
      console.log('Rate limit hit, using intelligent fallback');
      return getIntelligentFallback(prompt, context);
    }
    
    throw error;
  }
}

// Function to call OpenAI API with rate limit fallback
async function callOpenAI(type, prompt, context) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = getSystemPrompt(type);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Try to parse as JSON for structured responses
    if (type === 'bulk-tasks' || type === 'board-creation' || type === 'board-with-tasks') {
      try {
        const jsonResponse = JSON.parse(content);
        
        // Ensure the response has the correct structure for bulk tasks
        if (type === 'bulk-tasks') {
          // If the AI returned a direct tasks array, wrap it properly
          if (Array.isArray(jsonResponse)) {
            return {
              type: 'tasks',
              data: {
                tasks: jsonResponse
              }
            };
          }
          // If it's already properly structured, return as is
          if (jsonResponse.type === 'tasks' && jsonResponse.data && jsonResponse.data.tasks) {
            return jsonResponse;
          }
          // If it has tasks but wrong structure, fix it
          if (jsonResponse.tasks) {
            return {
              type: 'tasks',
              data: {
                tasks: jsonResponse.tasks
              }
            };
          }
        }
        
        // Ensure the response has the correct structure for board-with-tasks
        if (type === 'board-with-tasks') {
          // If it's already properly structured, return as is
          if (jsonResponse.type === 'board-with-tasks' && jsonResponse.data) {
            return jsonResponse;
          }
          // If it has the data but wrong structure, fix it
          if (jsonResponse.name && jsonResponse.columns) {
            return {
              type: 'board-with-tasks',
              data: {
                name: jsonResponse.name,
                description: jsonResponse.description || '',
                columns: jsonResponse.columns || [],
                tasks: jsonResponse.tasks || []
              }
            };
          }
        }
        
        return jsonResponse;
      } catch (e) {
        // If JSON parsing fails, use intelligent fallback for task types
        if (type === 'bulk-tasks') {
          return getIntelligentFallback(prompt, context);
        }
        if (type === 'board-with-tasks') {
          return getBoardWithTasksFallback(prompt, context);
        }
        throw e;
      }
    }

    // For non-structured responses, return as text
    // But if it's a bulk-tasks request, try to parse natural language into tasks
    if (type === 'bulk-tasks') {
      return parseNaturalLanguageIntoTasks(content, context);
    }
    
    // If it's a board-with-tasks request, try to parse natural language into board
    if (type === 'board-with-tasks') {
      return parseNaturalLanguageIntoBoard(content, context);
    }
    
    return {
      type: 'text',
      content: content.trim()
    };

  } catch (error) {
    console.error('OpenAI API error:', error);
    
    // Handle rate limiting gracefully
    if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
      console.log('Rate limit hit, using intelligent fallback');
      return getIntelligentFallback(prompt, context);
    }
    
    throw error;
  }
}

function getSystemPrompt(type) {
  const basePrompt = "You are a helpful AI assistant for project management and task organization. Provide clear, actionable, and well-structured responses.";
  
  switch (type) {
    case 'board-creation':
      return basePrompt + " Help users create project boards with appropriate names, descriptions, and column suggestions. Respond with a JSON object containing 'name', 'description', and 'columns' array with objects having 'name', 'description', and 'color' properties.";
    
    case 'board-with-tasks':
      return basePrompt + " Create a complete project board with columns and tasks. Respond ONLY with a JSON object in this exact format: {\"type\": \"board-with-tasks\", \"data\": {\"name\": \"Board Name\", \"description\": \"Board description\", \"columns\": [{\"name\": \"Column Name\", \"description\": \"Column purpose\", \"color\": \"#667eea\"}], \"tasks\": [{\"title\": \"Task Title\", \"description\": \"Task description\", \"story_points\": 5, \"priority\": \"High\"}]}}. Generate 3-4 columns (like To Do, In Progress, Done) and 5-10 relevant tasks. Story points should be 1-13 (Fibonacci sequence). Priority should be High/Medium/Low.";
    
    case 'bulk-tasks':
      return basePrompt + " Analyze content and generate actionable project management tasks. Respond ONLY with a JSON object in this exact format: {\"type\": \"tasks\", \"data\": {\"tasks\": [{\"title\": \"Task Title\", \"description\": \"Task description\", \"story_points\": 5, \"priority\": \"High\"}]}}. Generate 3-8 relevant tasks. Story points should be 1-13 (Fibonacci sequence). Priority should be High/Medium/Low.";
    
    case 'board-name':
    case 'board-description':
    case 'column-name':
    case 'task-title':
    case 'task-description':
      return basePrompt + " Provide helpful suggestions for project management content. Keep responses concise and professional. Return plain text responses.";
    
    default:
      return basePrompt + " Provide helpful suggestions for project management tasks.";
  }
}

function parseNaturalLanguageIntoTasks(content, context = {}) {
  console.log('Parsing natural language into tasks');
  
  const lines = content.split('\n').filter(line => line.trim());
  const tasks = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and headers
    if (!trimmed || trimmed.length < 3) continue;
    
    // Look for task-like patterns
    const taskPatterns = [
      /^[-*•]\s*(.+)$/,  // Bullet points
      /^\d+\.\s*(.+)$/,  // Numbered lists
      /^(?:Task|TODO|Action):\s*(.+)$/i,  // Task: prefix
      /^(.+)$/  // Any other line as a potential task
    ];
    
    let taskTitle = null;
    for (const pattern of taskPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        taskTitle = match[1].trim();
        break;
      }
    }
    
    if (taskTitle && taskTitle.length > 3) {
      // Extract description if there's a colon or dash
      let title = taskTitle;
      let description = '';
      
      const descMatch = taskTitle.match(/^([^:-]+)[:−-]\s*(.+)$/);
      if (descMatch) {
        title = descMatch[1].trim();
        description = descMatch[2].trim();
      }
      
      // Estimate story points based on complexity indicators
      let storyPoints = 3; // Default
      const complexityIndicators = {
        'research': 5, 'analyze': 5, 'design': 8, 'implement': 8, 'develop': 8,
        'create': 5, 'build': 8, 'test': 3, 'review': 2, 'document': 3,
        'plan': 5, 'setup': 3, 'configure': 3, 'deploy': 5, 'integrate': 8
      };
      
      for (const [keyword, points] of Object.entries(complexityIndicators)) {
        if (title.toLowerCase().includes(keyword)) {
          storyPoints = points;
          break;
        }
      }
      
      // Determine priority
      let priority = 'Medium';
      if (title.toLowerCase().includes('urgent') || title.toLowerCase().includes('critical')) {
        priority = 'High';
      } else if (title.toLowerCase().includes('optional') || title.toLowerCase().includes('nice')) {
        priority = 'Low';
      }
      
      tasks.push({
        title: title,
        description: description || `Complete the task: ${title}`,
        story_points: storyPoints,
        priority: priority
      });
    }
  }
  
  // If no tasks were parsed, create a fallback
  if (tasks.length === 0) {
    return getIntelligentFallback('generate tasks', context);
  }
  
  return {
    type: 'tasks',
    data: {
      tasks: tasks.slice(0, 10) // Limit to 10 tasks max
    }
  };
}

function parseNaturalLanguageIntoBoard(content, context = {}) {
  console.log('Parsing natural language into board with tasks');
  
  // Extract board name from content
  const lines = content.split('\n').filter(line => line.trim());
  let boardName = 'New Project Board';
  let boardDescription = '';
  
  // Look for title patterns
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && (trimmed.includes('Board:') || trimmed.includes('Project:') || trimmed.startsWith('#'))) {
      boardName = trimmed.replace(/^(Board:|Project:|#+)\s*/, '').trim();
      break;
    }
  }
  
  // Default columns
  const columns = [
    { name: 'To Do', description: 'Tasks to be started', color: '#3b82f6' },
    { name: 'In Progress', description: 'Tasks currently being worked on', color: '#f59e0b' },
    { name: 'Review', description: 'Tasks under review', color: '#8b5cf6' },
    { name: 'Done', description: 'Completed tasks', color: '#10b981' }
  ];
  
  // Parse tasks from content
  const tasks = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;
    
    const taskPatterns = [
      /^[-*•]\s*(.+)$/,
      /^\d+\.\s*(.+)$/,
      /^(?:Task|TODO|Action):\s*(.+)$/i
    ];
    
    let taskTitle = null;
    for (const pattern of taskPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        taskTitle = match[1].trim();
        break;
      }
    }
    
    if (taskTitle && taskTitle.length > 3 && !taskTitle.includes('Board:') && !taskTitle.includes('Project:')) {
      let title = taskTitle;
      let description = '';
      
      const descMatch = taskTitle.match(/^([^:-]+)[:−-]\s*(.+)$/);
      if (descMatch) {
        title = descMatch[1].trim();
        description = descMatch[2].trim();
      }
      
      // Estimate story points
      let storyPoints = 3;
      const complexityKeywords = ['design', 'implement', 'develop', 'build', 'integrate'];
      if (complexityKeywords.some(keyword => title.toLowerCase().includes(keyword))) {
        storyPoints = 8;
      } else if (title.toLowerCase().includes('test') || title.toLowerCase().includes('review')) {
        storyPoints = 2;
      }
      
      tasks.push({
        title: title,
        description: description || `Complete the task: ${title}`,
        story_points: storyPoints,
        priority: 'Medium'
      });
    }
  }
  
  // If no tasks found, create some default ones
  if (tasks.length === 0) {
    tasks.push(
      { title: 'Project Planning', description: 'Define project scope and requirements', story_points: 5, priority: 'High' },
      { title: 'Research & Analysis', description: 'Conduct necessary research and analysis', story_points: 3, priority: 'Medium' },
      { title: 'Implementation', description: 'Begin implementation work', story_points: 8, priority: 'High' }
    );
  }
  
  return {
    type: 'board-with-tasks',
    data: {
      name: boardName,
      description: boardDescription || `Project board for ${boardName}`,
      columns: columns,
      tasks: tasks.slice(0, 10)
    }
  };
}

function getBoardWithTasksFallback(prompt, context = {}) {
  console.log('Using board-with-tasks fallback');
  
  // Extract project type from prompt
  const promptLower = prompt.toLowerCase();
  let projectType = 'Project';
  let columns = [];
  let tasks = [];
  
  if (promptLower.includes('sales') || promptLower.includes('campaign')) {
    projectType = 'Sales Campaign';
    columns = [
      { name: 'Planning', description: 'Campaign planning and strategy', color: '#8b5cf6' },
      { name: 'In Progress', description: 'Active campaign activities', color: '#f59e0b' },
      { name: 'Review', description: 'Content and materials review', color: '#06b6d4' },
      { name: 'Launched', description: 'Live campaigns and completed tasks', color: '#10b981' }
    ];
    tasks = [
      { title: 'Market Research', description: 'Research target audience and competitors', story_points: 5, priority: 'High' },
      { title: 'Campaign Strategy', description: 'Develop overall campaign strategy and goals', story_points: 8, priority: 'High' },
      { title: 'Content Creation', description: 'Create marketing materials and content', story_points: 13, priority: 'High' },
      { title: 'Lead Generation Setup', description: 'Set up lead capture and tracking systems', story_points: 5, priority: 'Medium' },
      { title: 'Email Marketing', description: 'Create and schedule email campaigns', story_points: 8, priority: 'Medium' },
      { title: 'Social Media Campaign', description: 'Launch social media promotional content', story_points: 5, priority: 'Medium' },
      { title: 'Analytics Setup', description: 'Configure tracking and analytics', story_points: 3, priority: 'Medium' },
      { title: 'Campaign Launch', description: 'Go live with the sales campaign', story_points: 3, priority: 'High' }
    ];
  } else if (promptLower.includes('software') || promptLower.includes('app') || promptLower.includes('development')) {
    projectType = 'Software Development';
    columns = [
      { name: 'Backlog', description: 'Feature backlog and ideas', color: '#6b7280' },
      { name: 'To Do', description: 'Ready for development', color: '#3b82f6' },
      { name: 'In Progress', description: 'Currently developing', color: '#f59e0b' },
      { name: 'Testing', description: 'In QA and testing', color: '#8b5cf6' },
      { name: 'Done', description: 'Completed and deployed', color: '#10b981' }
    ];
    tasks = [
      { title: 'Project Setup', description: 'Initialize repository and development environment', story_points: 3, priority: 'High' },
      { title: 'Database Design', description: 'Design database schema and relationships', story_points: 8, priority: 'High' },
      { title: 'API Development', description: 'Build REST API endpoints', story_points: 13, priority: 'High' },
      { title: 'Frontend Framework', description: 'Set up frontend framework and routing', story_points: 5, priority: 'Medium' },
      { title: 'User Authentication', description: 'Implement user registration and login', story_points: 8, priority: 'High' },
      { title: 'UI Components', description: 'Create reusable UI components', story_points: 8, priority: 'Medium' }
    ];
  } else if (promptLower.includes('marketing')) {
    projectType = 'Marketing Campaign';
    columns = [
      { name: 'Planning', description: 'Strategy and planning', color: '#8b5cf6' },
      { name: 'Creative', description: 'Content and creative development', color: '#f59e0b' },
      { name: 'Review', description: 'Approval and review process', color: '#06b6d4' },
      { name: 'Live', description: 'Active campaigns', color: '#10b981' }
    ];
    tasks = [
      { title: 'Brand Guidelines', description: 'Establish brand guidelines and messaging', story_points: 5, priority: 'High' },
      { title: 'Content Calendar', description: 'Plan content calendar and posting schedule', story_points: 3, priority: 'High' },
      { title: 'Social Media Strategy', description: 'Develop social media marketing strategy', story_points: 8, priority: 'Medium' },
      { title: 'Ad Creative Design', description: 'Design advertising creatives and banners', story_points: 8, priority: 'Medium' },
      { title: 'Influencer Outreach', description: 'Identify and contact potential influencers', story_points: 5, priority: 'Low' }
    ];
  } else {
    // Default project
    columns = [
      { name: 'Backlog', description: 'Ideas and future tasks', color: '#6b7280' },
      { name: 'To Do', description: 'Tasks ready to start', color: '#3b82f6' },
      { name: 'In Progress', description: 'Active work items', color: '#f59e0b' },
      { name: 'Done', description: 'Completed tasks', color: '#10b981' }
    ];
    tasks = [
      { title: 'Project Kickoff', description: 'Initialize project and set up team', story_points: 3, priority: 'High' },
      { title: 'Requirements Analysis', description: 'Gather and analyze project requirements', story_points: 5, priority: 'High' },
      { title: 'Planning & Design', description: 'Create project plan and design documents', story_points: 8, priority: 'High' },
      { title: 'Implementation Phase 1', description: 'Begin core implementation work', story_points: 13, priority: 'Medium' }
    ];
  }
  
  return {
    type: 'board-with-tasks',
    data: {
      name: `${projectType} Board`,
      description: `Comprehensive project board for ${projectType.toLowerCase()} management`,
      columns: columns,
      tasks: tasks
    }
  };
}

function getIntelligentFallback(prompt, context = {}) {
  console.log('Using intelligent fallback response');
  
  const { taskType = 'general' } = context;
  
  // Generate contextual fallback based on prompt content and context
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes('task') || promptLower.includes('generate') || promptLower.includes('create')) {
    return {
      type: 'tasks',
      data: {
        tasks: [
          {
            title: `Analyze ${taskType} requirements`,
            description: 'Review and analyze the requirements to understand key objectives and specifications.',
            story_points: 5,
            priority: 'High'
          },
          {
            title: `Plan implementation strategy`,
            description: 'Develop a comprehensive implementation plan based on the requirements.',
            story_points: 8,
            priority: 'High'
          },
          {
            title: 'Create detailed specifications',
            description: 'Define detailed specifications and architecture needed for implementation.',
            story_points: 5,
            priority: 'Medium'
          }
        ]
      }
    };
  }
  
  // Default fallback for other types
  return {
    type: 'text',
    content: 'I\'m currently experiencing high usage. Please try again in a moment, or consider breaking down your request into smaller parts.'
  };
}

app.listen(PORT, () => {
  console.log(`🚀 Task Tiles API Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
}); 