import React, { useState } from 'react';

function TeamManagementPage() {
  const [teamId, setTeamId] = useState(''); // Example: or get from a list of teams
  const [sharepointUrl, setSharepointUrl] = useState('');

  const handleSetUrl = () => {
    // Placeholder for API call
    console.log(`Setting SharePoint URL for team ${teamId}: ${sharepointUrl}`);
    // For actual implementation:
    // import axios from 'axios';
    // axios.put(`/api/teams/${teamId}/sharepoint-folder`, { sharepoint_folder_url: sharepointUrl })
    //   .then(response => {
    //     console.log('SharePoint URL updated:', response.data);
    //     // Handle success (e.g., show a message, refresh team data)
    //   })
    //   .catch(error => {
    //     console.error('Error updating SharePoint URL:', error);
    //     // Handle error (e.g., show an error message)
    //   });
  };

  return (
    <div>
      <h1>Team Management Page</h1>
      {/* Placeholder for other team management UI elements, like a list of teams */}
      <hr />
      <div>
        <h2>Configure SharePoint Folder for a Team</h2>
        <div>
          <label htmlFor="teamIdInput">Team ID: </label>
          <input
            id="teamIdInput"
            type="text"
            placeholder="Enter Team ID"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            style={{ marginRight: '10px' }}
          />
        </div>
        <div style={{ marginTop: '10px' }}>
          <label htmlFor="sharepointUrlInput">SharePoint URL: </label>
          <input
            id="sharepointUrlInput"
            type="text"
            placeholder="Enter SharePoint Folder URL"
            value={sharepointUrl}
            onChange={(e) => setSharepointUrl(e.target.value)}
            style={{ marginRight: '10px', width: '300px' }}
          />
        </div>
        <button onClick={handleSetUrl} style={{ marginTop: '10px' }}>
          Set URL
        </button>
      </div>
    </div>
  );
}

export default TeamManagementPage;
