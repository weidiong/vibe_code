# Task Tiles - Full Stack Project Management

A modern, full-stack visual project management application inspired by Trello, featuring real-time database persistence, intuitive drag-and-drop functionality, and a beautiful responsive interface.

## 🚀 Features

### 🎯 Core Functionality
- **Multi-Board Support**: Create and manage multiple project boards
- **Visual Kanban Interface**: Drag-and-drop task tiles between customizable columns
- **Real-Time Persistence**: All data stored in PostgreSQL database with instant synchronization
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

### 🛠 Technical Stack
- **Backend**: Node.js, Express.js, PostgreSQL
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Database**: PostgreSQL with UUID primary keys and proper indexing
- **Deployment**: Docker, Docker Compose for easy setup

### 🎨 User Experience
- **Modern UI**: Beautiful gradient backgrounds, smooth animations, and hover effects
- **Toast Notifications**: Real-time feedback for all user actions
- **Connection Status**: Live connection indicator with offline handling
- **Keyboard Shortcuts**: Ctrl/Cmd + N for quick column creation, Escape to close modals

## 🔧 Installation & Setup

### Prerequisites
- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download here](https://www.postgresql.org/download/)
- **Git** - [Download here](https://git-scm.com/)

### Option 1: Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/weidiong/vibe_code.git
   cd vibe_code
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=task_tiles_db
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # CORS Configuration
   FRONTEND_URL=http://localhost:3000
   
   # Security
   JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Create database (run in psql or pgAdmin)
   CREATE DATABASE task_tiles_db;
   
   # Run database setup script
   npm run setup-db
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

### Option 2: Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/weidiong/vibe_code.git
   cd vibe_code
   ```

2. **Run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Application: `http://localhost:3000`
   - Database: `localhost:5432`

## 📖 Usage Guide

### Getting Started
1. **Create Your First Board**
   - Click "New Board" in the header
   - Give it a name and description
   - Click "Create Board"

2. **Add Columns**
   - Select your board from the dropdown
   - Click "Add Column"
   - Choose a name and color
   - Click "Add Column"

3. **Create Tasks**
   - Click "Add Task" in any column
   - Enter title and description
   - Click "Add Task"

4. **Manage Tasks**
   - Drag tasks between columns to update status
   - Click the edit icon to modify task details
   - Click the trash icon to delete tasks

### Advanced Features
- **Multiple Boards**: Switch between different projects using the board selector
- **Keyboard Shortcuts**: Use Ctrl/Cmd + N to quickly add columns
- **Real-time Updates**: All changes are immediately saved to the database
- **Connection Monitoring**: See your connection status in the top-right corner

## 🏗 Architecture

### Database Schema
```sql
-- Boards table
CREATE TABLE boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Columns table
CREATE TABLE columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) DEFAULT '#667eea',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    column_id UUID REFERENCES columns(id) ON DELETE CASCADE,
    board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints
- `GET /api/boards` - Get all boards
- `GET /api/boards/:id` - Get board with columns and tasks
- `POST /api/boards` - Create new board
- `POST /api/columns` - Create new column
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `PUT /api/tasks/:id/move` - Move task to different column
- `DELETE /api/tasks/:id` - Delete task
- `DELETE /api/columns/:id` - Delete column
- `DELETE /api/boards/:id` - Delete board

## 🔒 Security Features
- **Input Validation**: All API endpoints validate input data
- **Rate Limiting**: Prevents abuse with configurable rate limits
- **SQL Injection Protection**: Parameterized queries prevent SQL injection
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **Helmet.js**: Security headers for Express.js application

## 🚀 Deployment

### Production Environment
1. Set `NODE_ENV=production` in your environment variables
2. Use a strong JWT secret
3. Configure proper database credentials
4. Set up reverse proxy (nginx) for SSL termination
5. Use process manager (PM2) for production deployment

### Environment Variables
```env
NODE_ENV=production
DB_HOST=your-db-host
DB_NAME=task_tiles_db
DB_USER=your-db-user
DB_PASSWORD=your-strong-password
JWT_SECRET=your-super-secure-jwt-secret
PORT=3000
```

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments
- Inspired by Trello's intuitive project management approach
- Built with modern web technologies for optimal performance
- Designed with user experience and accessibility in mind

## 📞 Support
For questions or issues, please:
1. Check the existing GitHub issues
2. Create a new issue with detailed description
3. Include steps to reproduce any bugs

---

**Built with ❤️ using Node.js, PostgreSQL, and modern web technologies** 