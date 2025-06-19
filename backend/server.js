const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Ensure this is at the top

const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Ensure this is at the top

const db = require('./db'); // Import db module

const app = express();
const PORT = process.env.BACKEND_PORT || 5000; // Add BACKEND_PORT to .env

app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies

// Placeholder routes
app.get('/', (req, res) => {
  res.send('Performance Review Backend API');
});

app.post('/api/auth/login', (req, res) => res.status(501).json({ message: 'Login endpoint not implemented' }));
app.get('/api/employees', (req, res) => res.status(501).json({ message: 'Get employees not implemented' }));
app.post('/api/employees', (req, res) => res.status(501).json({ message: 'Create employee not implemented' }));
// ... other placeholder routes for teams, reviews etc.
app.get('/api/teams', (req, res) => res.status(501).json({ message: 'Get teams not implemented' }));
app.post('/api/teams', (req, res) => res.status(501).json({ message: 'Create team not implemented' }));
app.get('/api/reviews', (req, res) => res.status(501).json({ message: 'Get reviews not implemented' }));
app.post('/api/reviews', (req, res) => res.status(501).json({ message: 'Create review not implemented' }));

// Endpoint to update SharePoint folder URL for a team
app.put('/api/teams/:teamId/sharepoint-folder', async (req, res) => {
  const { teamId } = req.params;
  const { sharepoint_folder_url } = req.body;

  if (!sharepoint_folder_url) {
    return res.status(400).json({ message: 'sharepoint_folder_url is required' });
  }

  try {
    const updatedTeam = await db.updateTeamSharePointUrl(teamId, sharepoint_folder_url);
    if (updatedTeam) {
      res.json(updatedTeam);
    } else {
      res.status(404).json({ message: 'Team not found or update failed' });
    }
  } catch (error) {
    console.error('Error updating SharePoint folder URL:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Import email service
const { sendEmail, transporterPromise } = require('./emailService'); // Adjust path if needed

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ message: 'Missing to, subject, or html in request body' });
  }
  try {
    // Ensure transporter is ready before trying to send an email
    await transporterPromise;
    await sendEmail(to, subject, html);
    res.status(200).json({ message: 'Test email sent successfully! If using Ethereal, check server console for preview link.' });
  } catch (error) {
    console.error('Failed to send test email:', error); // Log the full error on the server
    res.status(500).json({ message: 'Failed to send test email', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
