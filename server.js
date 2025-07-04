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
  body('position').optional().isInt({ min: 0 }).withMessage('Position must be a non-negative integer')
], handleValidationErrors, async (req, res) => {
  try {
    const { column_id, board_id, title, description, position } = req.body;
    
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
      'INSERT INTO tasks (column_id, board_id, title, description, position) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [column_id, board_id, title, description, finalPosition]
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
  body('description').optional().trim()
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    
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
app.listen(PORT, () => {
  console.log(`🚀 Task Tiles API Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
}); 