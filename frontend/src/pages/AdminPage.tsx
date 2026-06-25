import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, teamsAPI, matchesAPI, saveToken, getToken, tournamentsAPI } from '@/lib/api';
import type { Team, Match, Tournament } from '@/types';
import './AdminPage.css';

export default function AdminPage() {
  const navigate = useNavigate();

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!getToken());
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Tab State
  const [activeTab, setActiveTab] = useState<'teams' | 'matches' | 'scorers'>('teams');

  // Loaded Data
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournament, setTournament] = useState<Tournament>({
    type: 'League',
    groups: {},
  });

  // Teams form inputs
  const [teamName, setTeamName] = useState<string>('');
  const [teamManager, setTeamManager] = useState<string>('');
  const [teamGroup, setTeamGroup] = useState<string>('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]); // array of team IDs

  // Group config inputs
  const [newGroupName, setNewGroupName] = useState<string>('');

  // Member management
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null); // team ID
  const [memberName, setMemberName] = useState<string>('');
  const [memberPosition, setMemberPosition] = useState<string>('');

  // Match fixture inputs
  const [matchGroup, setMatchGroup] = useState<string>('');
  const [team1, setTeam1] = useState<string>('');
  const [team2, setTeam2] = useState<string>('');
  const [matchSearchQuery, setMatchSearchQuery] = useState<string>('');

  // Edit match score state
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editScore1, setEditScore1] = useState<number>(0);
  const [editScore2, setEditScore2] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<'Upcoming' | 'Finished'>('Upcoming');

  // Scorer update state
  const [scorerTeamName, setScorerTeamName] = useState<string>('');
  const [scorerPlayerName, setScorerPlayerName] = useState<string>('');
  const [scorerGoals, setScorerGoals] = useState<number>(0);

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);

  const loadData = async () => {
    try {
      const [teamsList, matchesList, tournamentConfig] = await Promise.all([
        teamsAPI.getAll(),
        matchesAPI.getAll(),
        tournamentsAPI.get(),
      ]);
      setTeams(teamsList);
      setMatches(matchesList);
      if (tournamentConfig) {
        setTournament({
          ...tournamentConfig,
          groups: tournamentConfig.groups || {},
        });
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  // Auth Functions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const emailVal = email.trim();
    const passVal = password;

    if (!emailVal || !passVal) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      const response = await authAPI.login(emailVal, passVal);
      if (response && response.token) {
        saveToken(response.token);
        setIsLoggedIn(true);
        setEmail('');
        setPassword('');
      }
    } catch (err: any) {
      setError('Invalid email or password: ' + (err.message || err));
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setIsLoggedIn(false);
    navigate('/');
  };

  // Tournament Configuration
  const handleUpdateTournamentType = async (type: 'League' | 'Group Stage') => {
    const updated: Tournament = {
      ...tournament,
      type,
    };
    setTournament(updated);
    try {
      await tournamentsAPI.update(updated);
    } catch (err: any) {
      console.error('Failed to update tournament type:', err);
      alert('Failed to update tournament type: ' + (err.message || err));
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) {
      alert('Please enter a group name');
      return;
    }
    const groups = { ...(tournament.groups || {}) };
    if (groups[name]) {
      alert('Group already exists');
      return;
    }
    groups[name] = [];
    const updated: Tournament = {
      ...tournament,
      groups,
    };
    setTournament(updated);
    setNewGroupName('');
    try {
      await tournamentsAPI.update(updated);
    } catch (err: any) {
      console.error('Failed to add group:', err);
      alert('Failed to add group: ' + (err.message || err));
    }
  };

  const handleDeleteGroup = async (groupName: string) => {
    if (!window.confirm(`Delete ${groupName}?`)) return;
    const groups = { ...(tournament.groups || {}) };
    delete groups[groupName];
    const updated: Tournament = {
      ...tournament,
      groups,
    };
    setTournament(updated);
    try {
      await tournamentsAPI.update(updated);
    } catch (err: any) {
      console.error('Failed to delete group:', err);
      alert('Failed to delete group: ' + (err.message || err));
    }
  };

  const handleRemoveTeamFromGroup = async (teamName: string, groupName: string) => {
    const groups = { ...(tournament.groups || {}) };
    if (groups[groupName]) {
      groups[groupName] = groups[groupName].filter((t) => t !== teamName);
    }
    const updated: Tournament = {
      ...tournament,
      groups,
    };
    setTournament(updated);

    // Also update team model on the backend
    const team = teams.find((t) => t.name === teamName);
    if (team && team._id) {
      try {
        await teamsAPI.update(team._id, { ...team, group: '' });
      } catch (err) {
        console.error('Failed to reset group field on team model:', err);
      }
    }

    try {
      await tournamentsAPI.update(updated);
      await loadData();
    } catch (err: any) {
      console.error('Failed to save group change:', err);
      alert('Failed to save group assignment change: ' + (err.message || err));
    }
  };

  // Teams Management
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = teamName.trim();
    if (!name) {
      alert('Please enter a team name');
      return;
    }
    if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      alert('Team already exists');
      return;
    }

    try {
      const isGroupStage = tournament.type === 'Group Stage';
      await teamsAPI.create({
        name,
        manager: teamManager.trim(),
        group: isGroupStage ? teamGroup : '',
        members: [],
      });

      if (isGroupStage && teamGroup) {
        const groups = { ...(tournament.groups || {}) };
        if (groups[teamGroup]) {
          if (!groups[teamGroup].includes(name)) {
            groups[teamGroup] = [...groups[teamGroup], name];
          }
        } else {
          groups[teamGroup] = [name];
        }
        await tournamentsAPI.update({ ...tournament, groups });
      }

      setTeamName('');
      setTeamManager('');
      setTeamGroup('');
      await loadData();
    } catch (err: any) {
      alert('Failed to add team: ' + (err.message || err));
    }
  };

  const handleDeleteTeam = async (name: string) => {
    if (!window.confirm('Are you sure you want to delete this team? This will also remove any fixtures involving the team.')) return;
    const team = teams.find((t) => t.name === name);
    if (!team || !team._id) return;

    try {
      // Delete fixtures involving this team
      const matchesToDelete = matches.filter((m) => m.team1 === name || m.team2 === name);
      await Promise.all(matchesToDelete.map((m) => m._id && matchesAPI.delete(m._id)));

      // Delete team
      await teamsAPI.delete(team._id);

      // Clean from group stage setup
      const groups = { ...(tournament.groups || {}) };
      let hasGroupChange = false;
      Object.keys(groups).forEach((g) => {
        const before = groups[g].length;
        groups[g] = groups[g].filter((t) => t !== name);
        if (groups[g].length !== before) hasGroupChange = true;
      });
      if (hasGroupChange) {
        await tournamentsAPI.update({ ...tournament, groups });
      }

      if (currentTeamId === team._id) {
        setCurrentTeamId(null);
      }

      await loadData();
    } catch (err: any) {
      alert('Failed to delete team: ' + (err.message || err));
    }
  };

  const handleDeleteSelectedTeams = async () => {
    if (selectedTeams.length === 0) {
      alert('No teams selected');
      return;
    }
    const selectedNames = teams.filter((t) => t._id && selectedTeams.includes(t._id)).map((t) => t.name);
    if (!window.confirm(`Delete selected teams (${selectedNames.join(', ')}) and their fixtures?`)) return;

    try {
      // Delete match fixtures involving selected teams
      const matchesToDelete = matches.filter((m) => selectedNames.includes(m.team1) || selectedNames.includes(m.team2));
      await Promise.all(matchesToDelete.map((m) => m._id && matchesAPI.delete(m._id)));

      // Delete teams
      await Promise.all(selectedTeams.map((id) => teamsAPI.delete(id)));

      // Clean from groups setup
      const groups = { ...(tournament.groups || {}) };
      let hasGroupChange = false;
      Object.keys(groups).forEach((g) => {
        const before = groups[g].length;
        groups[g] = groups[g].filter((t) => !selectedNames.includes(t));
        if (groups[g].length !== before) hasGroupChange = true;
      });
      if (hasGroupChange) {
        await tournamentsAPI.update({ ...tournament, groups });
      }

      setSelectedTeams([]);
      if (currentTeamId && selectedTeams.includes(currentTeamId)) {
        setCurrentTeamId(null);
      }
      await loadData();
    } catch (err: any) {
      alert('Failed to delete selected teams: ' + (err.message || err));
    }
  };

  // Team Members
  const handleOpenMembers = (id: string) => {
    setCurrentTeamId(id);
    setMemberName('');
    setMemberPosition('');
  };

  const handleCloseMembers = () => {
    setCurrentTeamId(null);
    setMemberName('');
    setMemberPosition('');
  };

  const currentTeam = teams.find((t) => t._id === currentTeamId);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTeam || !currentTeam._id) return;
    const name = memberName.trim();
    if (!name) {
      alert('Please enter player name');
      return;
    }
    if (currentTeam.members?.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      alert('Player already exists in this team');
      return;
    }

    const updatedMembers = [
      ...(currentTeam.members || []),
      {
        name,
        position: memberPosition.trim() || '',
        goals: 0,
      },
    ];

    try {
      await teamsAPI.update(currentTeam._id, { ...currentTeam, members: updatedMembers });
      setMemberName('');
      setMemberPosition('');
      await loadData();
    } catch (err: any) {
      alert('Failed to add player: ' + (err.message || err));
    }
  };

  const handleDeleteMember = async (playerName: string) => {
    if (!currentTeam || !currentTeam._id) return;
    if (!window.confirm('Delete this player?')) return;

    const updatedMembers = (currentTeam.members || []).filter((m) => m.name !== playerName);
    try {
      await teamsAPI.update(currentTeam._id, { ...currentTeam, members: updatedMembers });
      await loadData();
    } catch (err: any) {
      alert('Failed to delete player: ' + (err.message || err));
    }
  };

  // Matches Management
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team1 || !team2) {
      alert('Please select both teams');
      return;
    }
    if (team1 === team2) {
      alert('Teams must be different');
      return;
    }

    const isGroupStage = tournament.type === 'Group Stage';
    {/*if (isGroupStage) {
      if (!matchGroup) {
        alert('Please select a group');
        return;
      }
      const groupTeams = tournament.groups?.[matchGroup] || [];
      if (!groupTeams.includes(team1) || !groupTeams.includes(team2)) {
        alert('Both teams must belong to the selected group');
        return;
      }
    }*/}

    try {
      await matchesAPI.create({
        team1,
        team2,
        score1: 0,
        score2: 0,
        status: 'Upcoming',
        group: isGroupStage ? matchGroup : '',
      });

      setTeam1('');
      setTeam2('');
      setMatchGroup('');
      await loadData();
    } catch (err: any) {
      alert('Failed to add match: ' + (err.message || err));
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!window.confirm('Are you sure you want to delete this fixture?')) return;
    try {
      await matchesAPI.delete(matchId);
      await loadData();
    } catch (err: any) {
      alert('Failed to delete match: ' + (err.message || err));
    }
  };

  const handleShowScoreForm = (match: Match) => {
    if (editingMatchId === match._id) {
      setEditingMatchId(null);
    } else {
      setEditingMatchId(match._id || null);
      setEditScore1(match.score1);
      setEditScore2(match.score2);
      setEditStatus(match.status);
    }
  };

  const handleSaveMatchScore = async (matchId: string) => {
    const match = matches.find((m) => m._id === matchId);
    if (!match) return;

    try {
      // Map 'Finished' -> 'completed', 'Upcoming' -> 'pending' to keep schema consistent if required,
      // but backend expects schema match. status on backend schema has enum: ['Upcoming', 'Finished'].
      // So we use 'Upcoming' or 'Finished' as status directly.
      await matchesAPI.update(matchId, {
        ...match,
        score1: editScore1,
        score2: editScore2,
        status: editStatus as any,
      });
      setEditingMatchId(null);
      await loadData();
    } catch (err: any) {
      alert('Failed to save score: ' + (err.message || err));
    }
  };

  // Scorers Management
  const handleUpdatePlayerGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scorerTeamName || !scorerPlayerName) {
      alert('Please fill all fields');
      return;
    }
    const team = teams.find((t) => t.name === scorerTeamName);
    if (!team || !team._id) return;

    const updatedMembers = (team.members || []).map((m) => {
      if (m.name === scorerPlayerName) {
        return { ...m, goals: Number(scorerGoals) || 0 };
      }
      return m;
    });

    try {
      await teamsAPI.update(team._id, { ...team, members: updatedMembers });
      setScorerTeamName('');
      setScorerPlayerName('');
      setScorerGoals(0);
      await loadData();
      alert('Goals updated successfully!');
    } catch (err: any) {
      alert('Failed to update goals: ' + (err.message || err));
    }
  };

  const handleResetPlayerGoals = async (teamName: string, playerName: string) => {
    if (!window.confirm('Reset goals for this player?')) return;
    const team = teams.find((t) => t.name === teamName);
    if (!team || !team._id) return;

    const updatedMembers = (team.members || []).map((m) => {
      if (m.name === playerName) {
        return { ...m, goals: 0 };
      }
      return m;
    });

    try {
      await teamsAPI.update(team._id, { ...team, members: updatedMembers });
      await loadData();
    } catch (err: any) {
      alert('Failed to reset goals: ' + (err.message || err));
    }
  };

  // ---------------------------------------------------------------------------
  // Points Table — only Finished matches, FIFA sort: Pts → GD → GF → name
  // Returns rows grouped by group name (or 'League' for non-group-stage)
  // ---------------------------------------------------------------------------
  type StandingRow = {
    team: string; played: number; won: number; drawn: number;
    lost: number; gf: number; ga: number; gd: number; points: number;
  };

  // All status values treated as "completed" — matches any casing
  const FINISHED_STATUSES = new Set([
    'Finished', 'finished', 'completed', 'Completed', 'done', 'Done',
  ]);

  const computeStandings = (): Record<string, StandingRow[]> => {
    const table: Record<string, StandingRow> = {};

    teams.forEach((t) => {
      table[t.name] = { team: t.name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
    });

    matches.forEach((match) => {
      // Only count finished/completed matches — ignore Upcoming, Scheduled, etc.
      if (!FINISHED_STATUSES.has(match.status)) return;
      const t1 = table[match.team1];
      const t2 = table[match.team2];
      if (!t1 || !t2) return;

      const s1 = Number(match.score1) || 0;
      const s2 = Number(match.score2) || 0;

      t1.played += 1; t2.played += 1;
      t1.gf += s1; t1.ga += s2;
      t2.gf += s2; t2.ga += s1;

      if (s1 > s2)      { t1.won += 1; t2.lost += 1; t1.points += 3; }
      else if (s1 < s2) { t2.won += 1; t1.lost += 1; t2.points += 3; }
      else              { t1.drawn += 1; t2.drawn += 1; t1.points += 1; t2.points += 1; }
    });

    Object.values(table).forEach((r) => { r.gd = r.gf - r.ga; });

    // FIFA sort helper
    const fifaSort = (a: StandingRow, b: StandingRow) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    };

    const isGroupStage = tournament.type === 'Group Stage';

    if (!isGroupStage) {
      return { League: Object.values(table).sort(fifaSort) };
    }

    // Group Stage: split by group using tournament.groups membership
    const groups = tournament.groups || {};
    const byGroup: Record<string, StandingRow[]> = {};

    Object.keys(groups).forEach((groupName) => {
      const groupTeamNames: string[] = Array.isArray(groups[groupName]) ? groups[groupName] : [];
      byGroup[groupName] = groupTeamNames
        .map((name) => table[name])
        .filter(Boolean)
        .sort(fifaSort);
    });

    // Teams not assigned to any group shown under 'Unassigned'
    const assignedTeams = new Set(Object.values(groups).flat());
    const unassigned = Object.values(table)
      .filter((r) => !assignedTeams.has(r.team))
      .sort(fifaSort);
    if (unassigned.length > 0) {
      byGroup['Unassigned'] = unassigned;
    }

    return byGroup;
  };


  return (
    <div className="admin-page-root">
      <div className="container">
        <div className="page-wrapper">
          <button className="back-btn" onClick={() => navigate('/')}>
            ← Back
          </button>

          <div className="page-header">
            <h1>🔑 Admin Panel</h1>
            <p>Football Tournament Management</p>
            {isLoggedIn && (
              <button
                id="logoutBtn"
                className="btn btn-guest"
                style={{ display: 'inline-block', marginTop: '10px' }}
                onClick={handleLogout}
              >
                Logout
              </button>
            )}
          </div>

          {!isLoggedIn ? (
            <div id="adminLogin" className="page-content">
              <div className="form-section login-card" style={{ maxWidth: '420px', margin: '0 auto' }}>
                <h2>Admin Login</h2>
                <form onSubmit={handleLogin} className="admin-form">
                  <div className="form-group">
                    <label htmlFor="adminEmail">Email:</label>
                    <input
                      type="email"
                      id="adminEmail"
                      placeholder="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="adminPassword">Password:</label>
                    <input
                      type="password"
                      id="adminPassword"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-admin">
                    Enter
                  </button>
                </form>
                {error && (
                  <div id="loginError" style={{ display: 'block', color: '#b00020', marginTop: '10px' }}>
                    {error}
                  </div>
                )}
                <p style={{ marginTop: '12px', color: '#666', fontSize: '0.95rem' }}>
                  Use the admin email and password to access this page.
                </p>
              </div>
            </div>
          ) : (
            <div id="adminContent" className="page-content">
              {/* Admin Navigation Tabs */}
              <div className="admin-tabs">
                <button
                  className={`admin-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
                  onClick={() => setActiveTab('teams')}
                >
                  ⚽ Manage Teams
                </button>
                <button
                  className={`admin-tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
                  onClick={() => setActiveTab('matches')}
                >
                  📅 Manage Matches
                </button>
                <button
                  className={`admin-tab-btn ${activeTab === 'scorers' ? 'active' : ''}`}
                  onClick={() => setActiveTab('scorers')}
                >
                  🥅 Manage Scorers
                </button>
              </div>

              {/* Teams Management Tab */}
              <div id="teams" className={`admin-tab-content ${activeTab === 'teams' ? 'active' : ''}`}>
                <div className="form-section">
                  <h2>Tournament Setup</h2>
                  <div className="form-group">
                    <label htmlFor="tournamentType">Tournament Type:</label>
                    <select
                      id="tournamentType"
                      value={tournament.type || ''}
                      onChange={(e) => handleUpdateTournamentType(e.target.value as 'League' | 'Group Stage')}
                    >
                      <option value="">Select Type</option>
                      <option value="League">League</option>
                      <option value="Group Stage">Group Stage</option>
                    </select>
                  </div>

                  {tournament.type === 'Group Stage' && (
                    <div id="groupStageConfig" style={{ marginTop: '20px' }}>
                      <form onSubmit={handleAddGroup} style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                          <label htmlFor="newGroupName">New Group Name:</label>
                          <input
                            type="text"
                            id="newGroupName"
                            placeholder="e.g. Group A"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="btn btn-admin">
                          Add Group
                        </button>
                      </form>
                      <div id="groupAssignments" className="items-list" style={{ marginTop: '20px' }}>
                        {Object.keys(tournament.groups || {}).length === 0 ? (
                          <div className="empty-state">
                            <p>No groups created yet. Add a group to assign teams.</p>
                          </div>
                        ) : (
                          Object.keys(tournament.groups || {}).map((groupName) => {
                            const assignedTeams = tournament.groups?.[groupName] || [];
                            return (
                              <div key={groupName} className="item-card group-card">
                                <div
                                  className="item-info"
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}
                                >
                                  <div>
                                    <div className="item-title">{groupName}</div>
                                    <div className="item-subtitle">{assignedTeams.length} team(s)</div>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn-small btn-delete"
                                    onClick={() => handleDeleteGroup(groupName)}
                                  >
                                    Delete Group
                                  </button>
                                </div>
                                <div className="group-team-list">
                                  {assignedTeams.length === 0 ? (
                                    <div className="empty-state">
                                      <p>No teams assigned</p>
                                    </div>
                                  ) : (
                                    assignedTeams.map((tName) => (
                                      <div key={tName} className="group-team-item">
                                        <span>{tName}</span>
                                        <button
                                          type="button"
                                          className="btn-small btn-delete"
                                          onClick={() => handleRemoveTeamFromGroup(tName, groupName)}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-section">
                  <h2>Add Team</h2>
                  <form onSubmit={handleCreateTeam} className="admin-form">
                    <div className="form-group">
                      <label htmlFor="teamName">Team Name:</label>
                      <input
                        type="text"
                        id="teamName"
                        placeholder="Enter team name"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="teamManager">Manager (optional):</label>
                      <input
                        type="text"
                        id="teamManager"
                        placeholder="Enter manager name (optional)"
                        value={teamManager}
                        onChange={(e) => setTeamManager(e.target.value)}
                      />
                    </div>
                    {tournament.type === 'Group Stage' && (
                      <div id="teamGroupSelect" className="form-group">
                        <label htmlFor="teamGroup">Group:</label>
                        <select id="teamGroup" value={teamGroup} onChange={(e) => setTeamGroup(e.target.value)}>
                          <option value="">Select group</option>
                          {Object.keys(tournament.groups || {}).map((groupName) => (
                            <option key={groupName} value={groupName}>
                              {groupName}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button type="submit" className="btn btn-admin">
                      Add Team
                    </button>
                  </form>
                </div>

                <div className="list-section">
                  <h2>Teams & Members</h2>
                  <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button type="button" className="btn btn-delete" onClick={handleDeleteSelectedTeams}>
                      Delete Selected
                    </button>
                  </div>
                  <div id="teamsList" className="items-list">
                    {teams.length === 0 ? (
                      <div className="empty-state">
                        <p>No teams added yet</p>
                      </div>
                    ) : (
                      teams.map((t) => {
                        const isChecked = selectedTeams.includes(t._id || '');
                        return (
                          <div key={t.name} className="item-card">
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', width: '100%' }}>
                              <div style={{ marginTop: '6px' }}>
                                <input
                                  type="checkbox"
                                  className="team-checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedTeams([...selectedTeams, t._id || '']);
                                    } else {
                                      setSelectedTeams(selectedTeams.filter((id) => id !== t._id));
                                    }
                                  }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div className="item-info">
                                  <div className="item-title">⚽ {t.name}</div>
                                  <div className="item-subtitle">
                                    {t.members?.length || 0} players
                                    {t.manager ? ` • Manager: ${t.manager}` : ''}
                                    {t.group ? ` • Group: ${t.group}` : ''}
                                  </div>
                                </div>
                              </div>
                              <div className="item-actions">
                                <button
                                  type="button"
                                  className="btn-small btn-edit"
                                  onClick={() => handleOpenMembers(t._id || '')}
                                >
                                  Add Members
                                </button>
                                <button
                                  type="button"
                                  className="btn-small btn-delete"
                                  onClick={() => handleDeleteTeam(t.name)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Team Members Management Section */}
                {currentTeamId && currentTeam && (
                  <div id="membersSection" className="form-section" style={{ marginTop: '30px' }}>
                    <h2>Add Team Members</h2>
                    <div
                      id="selectedTeamInfo"
                      style={{ marginBottom: '15px', padding: '10px', background: '#e8f4f8', borderRadius: '8px' }}
                    >
                      <strong>Currently managing:</strong> {currentTeam.name}
                      {currentTeam.manager ? ` - Manager: ${currentTeam.manager}` : ''}
                    </div>
                    <form onSubmit={handleAddMember} className="admin-form">
                      <div className="form-group">
                        <label htmlFor="memberName">Player Name:</label>
                        <input
                          type="text"
                          id="memberName"
                          placeholder="Enter player name"
                          value={memberName}
                          onChange={(e) => setMemberName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="memberPosition">Position:</label>
                        <input
                          type="text"
                          id="memberPosition"
                          placeholder="Enter player position"
                          value={memberPosition}
                          onChange={(e) => setMemberPosition(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="submit" className="btn btn-admin">
                          Add Member
                        </button>
                        <button type="button" className="btn btn-guest" onClick={handleCloseMembers}>
                          Close
                        </button>
                      </div>
                    </form>

                    <div className="list-section" style={{ marginTop: '20px' }}>
                      <h3>Team Members</h3>
                      <div id="membersList" className="items-list">
                        {!currentTeam.members || currentTeam.members.length === 0 ? (
                          <div className="empty-state">
                            <p>No players in this team</p>
                          </div>
                        ) : (
                          currentTeam.members.map((m) => (
                            <div key={m.name} className="item-card">
                              <div className="item-info">
                                <div className="item-title">{m.name}</div>
                                <div className="item-subtitle">{m.position || 'No Position'}</div>
                              </div>
                              <div className="item-actions">
                                <button
                                  type="button"
                                  className="btn-small btn-delete"
                                  onClick={() => handleDeleteMember(m.name)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Points Table Section */}
                {(() => {
                  const standingsByGroup = computeStandings();
                  const groupNames = Object.keys(standingsByGroup);
                  const hasData = teams.length > 0;
                  const isGroupStage = tournament.type === 'Group Stage';

                  const renderTable = (rows: ReturnType<typeof computeStandings>[string], groupTitle?: string) => (
                    <div key={groupTitle} style={{ marginBottom: '28px' }}>
                      {groupTitle && isGroupStage && (
                        <h3 style={{ margin: '0 0 8px 0', color: '#2d6a4f', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#40916c' }} />
                          {groupTitle}
                        </h3>
                      )}
                      <div className="points-table-wrap">
                        <table className="points-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #40916c', background: '#f0faf4' }}>
                              <th style={{ padding: '8px 6px' }}>#</th>
                              <th style={{ padding: '8px 6px' }}>Team</th>
                              <th style={{ padding: '8px 6px', textAlign: 'center' }} title="Played">P</th>
                              <th style={{ padding: '8px 6px', textAlign: 'center' }} title="Won">W</th>
                              <th style={{ padding: '8px 6px', textAlign: 'center' }} title="Drawn">D</th>
                              <th style={{ padding: '8px 6px', textAlign: 'center' }} title="Lost">L</th>
                              <th style={{ padding: '8px 6px', textAlign: 'center' }} title="Goals For">GF</th>
                              <th style={{ padding: '8px 6px', textAlign: 'center' }} title="Goals Against">GA</th>
                              <th style={{ padding: '8px 6px', textAlign: 'center' }} title="Goal Difference">GD</th>
                              <th style={{ padding: '8px 6px', textAlign: 'center' }} title="Points">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr
                                key={row.team}
                                style={{
                                  background: i % 2 === 0 ? '#fff' : '#f8fdf9',
                                  borderBottom: '1px solid #e8f5e9',
                                }}
                              >
                                <td style={{ padding: '7px 6px', color: '#666', fontWeight: 600 }}>{i + 1}</td>
                                <td className="team-cell" style={{ padding: '7px 6px', fontWeight: 500 }}>{row.team}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center' }}>{row.played}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center', color: '#2d6a4f', fontWeight: 500 }}>{row.won}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center', color: '#b7950b' }}>{row.drawn}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center', color: '#c0392b' }}>{row.lost}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center' }}>{row.gf}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center' }}>{row.ga}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: 500, color: row.gd > 0 ? '#2d6a4f' : row.gd < 0 ? '#c0392b' : '#555' }}>
                                  {row.gd > 0 ? `+${row.gd}` : row.gd}
                                </td>
                                <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: 700, color: '#1a3d8f', fontSize: '1rem' }}>{row.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );

                  return (
                    <div className="list-section" style={{ marginTop: '20px' }}>
                      <h2>Points Table</h2>
                      {!hasData ? (
                        <div className="empty-state"><p>No teams added yet</p></div>
                      ) : groupNames.length === 0 ? (
                        <div className="empty-state"><p>No teams or finished matches yet</p></div>
                      ) : (
                        groupNames.map((groupName) =>
                          renderTable(standingsByGroup[groupName], isGroupStage ? groupName : undefined)
                        )
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Matches Tab */}
              <div id="matches" className={`admin-tab-content ${activeTab === 'matches' ? 'active' : ''}`}>
                <div className="form-section">
                  <h2>Create Fixture</h2>
                  <form onSubmit={handleCreateMatch} className="admin-form">
                    {tournament.type === 'Group Stage' && (
                      <div id="matchGroupSelect" className="form-group">
                        <label htmlFor="matchGroup">Group:</label>
                        <select
                          id="matchGroup"
                          value={matchGroup}
                          onChange={(e) => {
                            setMatchGroup(e.target.value);
                            setTeam1('');
                            setTeam2('');
                          }}
                        >
                          <option value="">Select group</option>
                          {Object.keys(tournament.groups || {}).map((groupName) => (
                            <option key={groupName} value={groupName}>
                              {groupName}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="team1">Team 1:</label>
                        <select id="team1" value={team1} onChange={(e) => setTeam1(e.target.value)} required>
                          <option value="">Select Team</option>
                          {(tournament.type === 'Group Stage' && matchGroup
                            ? tournament.groups?.[matchGroup] || []
                            : teams.map((t) => t.name)
                          ).map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="team2">Team 2:</label>
                        <select id="team2" value={team2} onChange={(e) => setTeam2(e.target.value)} required>
                          <option value="">Select Team</option>
                          {(tournament.type === 'Group Stage' && matchGroup
                            ? tournament.groups?.[matchGroup] || []
                            : teams.map((t) => t.name)
                          ).map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-admin">
                      Create Fixture
                    </button>
                  </form>
                </div>

                <div className="list-section">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                      marginBottom: '15px',
                    }}
                  >
                    <h2 style={{ margin: 0 }}>Fixtures & Update Scores</h2>
                    <input
                      id="matchSearch"
                      className="match-search-input"
                      type="text"
                      placeholder="Search team vs team"
                      value={matchSearchQuery}
                      onChange={(e) => setMatchSearchQuery(e.target.value)}
                    />
                  </div>
                  <div id="matchesList" className="items-list">
                    {(() => {
                      const query = matchSearchQuery.replace(/\s+/g, ' ').trim().toLowerCase();
                      const filtered = matches.filter((match) => {
                        if (!query) return true;
                        const teamPair = `${match.team1} vs ${match.team2}`.toLowerCase();
                        const reversePair = `${match.team2} vs ${match.team1}`.toLowerCase();
                        const teamNames = `${match.team1} ${match.team2}`.toLowerCase();
                        return (
                          teamPair.includes(query) ||
                          reversePair.includes(query) ||
                          teamNames.includes(query) ||
                          match.team1.toLowerCase().includes(query) ||
                          match.team2.toLowerCase().includes(query)
                        );
                      });

                      if (filtered.length === 0) {
                        const emptyText = matchSearchQuery ? 'No matches found for this search' : 'No fixtures created yet';
                        return (
                          <div className="empty-state">
                            <p>{emptyText}</p>
                          </div>
                        );
                      }

                      return filtered.map((match) => (
                        <div key={match._id} className="item-card match-card" id={`matchCard${match._id}`}>
                          <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div className="item-info">
                                <div className="item-title">
                                  <span>{match.team1}</span>
                                  <span className="match-score">
                                    {match.score1} - {match.score2}
                                  </span>
                                  <span>{match.team2}</span>
                                </div>
                                <div className="match-time">Status: {match.status}</div>
                              </div>
                              <div className="item-actions">
                                <button
                                  type="button"
                                  className="btn-small btn-edit"
                                  onClick={() => handleShowScoreForm(match)}
                                >
                                  Update Score
                                </button>
                                <button
                                  type="button"
                                  className="btn-small btn-delete"
                                  onClick={() => handleDeleteMatch(match._id || '')}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {editingMatchId === match._id && (
                              <div className="score-update-form" id={`scoreForm${match._id}`}>
                                <div className="form-row">
                                  <div className="form-group">
                                    <label>{match.team1} Score:</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={editScore1}
                                      onChange={(e) => setEditScore1(Number(e.target.value) || 0)}
                                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>{match.team2} Score:</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={editScore2}
                                      onChange={(e) => setEditScore2(Number(e.target.value) || 0)}
                                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                                    />
                                  </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: '10px' }}>
                                  <label style={{ fontSize: '0.85rem', marginBottom: '5px' }}>Status:</label>
                                  <select
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value as 'Upcoming' | 'Finished')}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                                  >
                                    <option value="Upcoming">Upcoming</option>
                                    <option value="Finished">Finished</option>
                                  </select>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <button
                                    type="button"
                                    className="btn-small btn-admin"
                                    style={{ background: '#667eea', color: 'white', flex: 1 }}
                                    onClick={() => handleSaveMatchScore(match._id || '')}
                                  >
                                    Save Score
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-small btn-delete"
                                    style={{ flex: 1 }}
                                    onClick={() => setEditingMatchId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Scorers Tab */}
              <div id="scorers" className={`admin-tab-content ${activeTab === 'scorers' ? 'active' : ''}`}>
                <div className="form-section">
                  <h2>Update Player Goals</h2>
                  <form onSubmit={handleUpdatePlayerGoals} className="admin-form">
                    <div className="form-group">
                      <label htmlFor="scorerTeam2">Select Team:</label>
                      <select
                        id="scorerTeam2"
                        value={scorerTeamName}
                        onChange={(e) => {
                          setScorerTeamName(e.target.value);
                          setScorerPlayerName('');
                        }}
                        required
                      >
                        <option value="">Select Team</option>
                        {teams.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="scorerPlayer">Select Player:</label>
                      <select
                        id="scorerPlayer"
                        value={scorerPlayerName}
                        onChange={(e) => setScorerPlayerName(e.target.value)}
                        required
                      >
                        <option value="">Select Player</option>
                        {(teams.find((t) => t.name === scorerTeamName)?.members || []).map((m) => (
                          <option key={m.name} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="scorerGoals">Goals Scored:</label>
                      <input
                        type="number"
                        id="scorerGoals"
                        min="0"
                        placeholder="0"
                        value={scorerGoals}
                        onChange={(e) => setScorerGoals(Number(e.target.value) || 0)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-admin">
                      Update Goals
                    </button>
                  </form>
                </div>

                <div className="list-section">
                  <h2>Top Scorers</h2>
                  <div id="scorersList" className="items-list">
                    {(() => {
                      const allScorers: { name: string; team: string; goals: number }[] = [];
                      teams.forEach((t) => {
                        (t.members || []).forEach((m) => {
                          if (m.goals > 0) {
                            allScorers.push({
                              name: m.name,
                              team: t.name,
                              goals: m.goals,
                            });
                          }
                        });
                      });

                      allScorers.sort((a, b) => b.goals - a.goals);

                      if (allScorers.length === 0) {
                        return (
                          <div className="empty-state">
                            <p>No scorers yet</p>
                          </div>
                        );
                      }

                      return allScorers.map((scorer, index) => {
                        let rankClass = '';
                        if (index === 0) rankClass = 'rank-1';
                        else if (index === 1) rankClass = 'rank-2';
                        else if (index === 2) rankClass = 'rank-3';

                        return (
                          <div
                            key={`${scorer.team}_${scorer.name}`}
                            className={`item-card scorer-card-admin ${rankClass}`}
                          >
                            <div className="item-info">
                              <div className="item-title">
                                <span>
                                  {index + 1}. {scorer.name}
                                </span>
                                <span className="goals-badge">{scorer.goals} Goals</span>
                              </div>
                              <div className="item-subtitle">{scorer.team}</div>
                            </div>
                            <div className="item-actions">
                              <button
                                type="button"
                                className="btn-small btn-delete"
                                onClick={() => handleResetPlayerGoals(scorer.team, scorer.name)}
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
