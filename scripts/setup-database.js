const pool = require('../config/database');

const createTables = async () => {
  try {
    // Create boards table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create columns table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS columns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(7) DEFAULT '#667eea',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        column_id UUID REFERENCES columns(id) ON DELETE CASCADE,
        board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        story_points INTEGER DEFAULT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add story_points column if it doesn't exist (for existing databases)
    try {
      await pool.query(`
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS story_points INTEGER DEFAULT NULL;
      `);
      console.log('✅ Added story_points column to existing tasks table');
    } catch (error) {
      console.log('ℹ️ story_points column already exists or could not be added');
    }

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_board_id ON tasks(board_id);
    `);

    // Insert default board and columns
    const boardResult = await pool.query(`
      INSERT INTO boards (name, description) 
      VALUES ('My First Board', 'Welcome to Task Tiles - your visual project management tool!')
      ON CONFLICT DO NOTHING
      RETURNING id
    `);

    if (boardResult.rows.length > 0) {
      const boardId = boardResult.rows[0].id;
      
      // Insert default columns
      const columns = [
        { name: 'To Do', color: '#667eea', position: 0 },
        { name: 'In Progress', color: '#f093fb', position: 1 },
        { name: 'Done', color: '#4ecdc4', position: 2 }
      ];

      for (const col of columns) {
        const columnResult = await pool.query(`
          INSERT INTO columns (board_id, name, color, position)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [boardId, col.name, col.color, col.position]);

        // Insert sample tasks
        if (col.name === 'To Do') {
          await pool.query(`
            INSERT INTO tasks (column_id, board_id, title, description, story_points, position)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [columnResult.rows[0].id, boardId, 'Design UI Components', 'Create wireframes and mockups for the main interface', 8, 0]);
          await pool.query(`
            INSERT INTO tasks (column_id, board_id, title, description, story_points, position)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [columnResult.rows[0].id, boardId, 'User Authentication System', 'Implement login and registration functionality', 13, 1]);
        } else if (col.name === 'In Progress') {
          await pool.query(`
            INSERT INTO tasks (column_id, board_id, title, description, story_points, position)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [columnResult.rows[0].id, boardId, 'Setup Database', 'Configure PostgreSQL and create schema', 5, 0]);
        } else if (col.name === 'Done') {
          await pool.query(`
            INSERT INTO tasks (column_id, board_id, title, description, story_points, position)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [columnResult.rows[0].id, boardId, 'Project Planning', 'Define requirements and technical architecture', 3, 0]);
          await pool.query(`
            INSERT INTO tasks (column_id, board_id, title, description, story_points, position)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [columnResult.rows[0].id, boardId, 'Initial Setup', 'Setup development environment and tools', 2, 1]);
        }
      }
    }

    console.log('✅ Database tables created successfully!');
    console.log('✅ Sample data inserted!');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error;
  }
};

// Run the setup
createTables()
  .then(() => {
    console.log('🎉 Database setup completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Database setup failed:', error);
    process.exit(1);
  }); 