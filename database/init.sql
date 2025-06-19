-- Users table (for HR team)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- Store hashed passwords
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    sharepoint_folder_url VARCHAR(1024), -- To store the specific SharePoint folder URL for the team
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(100) NOT NULL UNIQUE, -- e.g., company employee ID
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL, -- Employee belongs to a team
    is_manager BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Reviews table
CREATE TABLE IF NOT EXISTS performance_reviews (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id INTEGER REFERENCES employees(id) ON DELETE SET NULL, -- Could be a manager or HR
    review_type VARCHAR(50) NOT NULL CHECK (review_type IN ('individual', 'team_feedback')), -- Type of review
    content TEXT, -- Stores the actual review content (e.g., JSON, structured text)
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'acknowledged')),
    due_date DATE,
    submission_date TIMESTAMP WITH TIME ZONE,
    sharepoint_file_url VARCHAR(1024), -- Link to the file in SharePoint if applicable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Team Evaluations table (for team-level evaluations)
CREATE TABLE IF NOT EXISTS team_evaluations (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    evaluator_id INTEGER REFERENCES employees(id) ON DELETE SET NULL, -- Who conducted the team evaluation
    evaluation_period VARCHAR(100), -- e.g., "Q4 2023"
    content TEXT, -- Stores the team evaluation details
    overall_rating DECIMAL(3, 2), -- Example: 4.50
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table (to manage sending notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    performance_review_id INTEGER REFERENCES performance_reviews(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE, -- Employee to notify
    notification_type VARCHAR(100) NOT NULL CHECK (notification_type IN ('deadline_reminder', 'submission_confirmation', 'overdue_alert', 'file_upload_alert')),
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update 'updated_at' on table updates
CREATE TRIGGER set_timestamp_performance_reviews
BEFORE UPDATE ON performance_reviews
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_team_evaluations
BEFORE UPDATE ON team_evaluations
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Seed some initial data (optional, for development)
-- Example: Add an HR user
-- INSERT INTO users (username, password_hash, email) VALUES ('hr_admin', 'hashed_password_example', 'hr@example.com');
-- Example: Add a team
-- INSERT INTO teams (name, sharepoint_folder_url) VALUES ('Engineering', 'https://example.sharepoint.com/sites/EngineeringDocs');
