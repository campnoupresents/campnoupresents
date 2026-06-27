import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { teamsAPI, matchesAPI, tournamentsAPI } from '@/lib/api';
import type { Team, Match, Scorer, Tournament } from '@/types';

// ─────────────────────────────────────────────
// Standing row type
// ─────────────────────────────────────────────
interface StandingRow {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

// ─────────────────────────────────────────────
// Statuses that count as "completed"
// ─────────────────────────────────────────────
const FINISHED_STATUSES = new Set([
  'Finished',
  'finished',
  'completed',
  'Completed',
  'done',
  'Done',
]);

export default function GuestPage() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [tournament, setTournament] = useState<Tournament>({ type: 'League', groups: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [teamsData, matchesData, tournamentData] = await Promise.all([
        teamsAPI.getAll(),
        matchesAPI.getAll(),
        tournamentsAPI.get(),
      ]);

      setTeams(teamsData);
      setMatches(matchesData);

      if (tournamentData) {
        setTournament({
          ...tournamentData,
          groups: tournamentData.groups || {},
        });
      }

      // Calculate top scorers from team member goals
      const allScorers: Scorer[] = [];
      teamsData.forEach((team) => {
        team.members?.forEach((member) => {
          if (member.goals > 0) {
            allScorers.push({ name: member.name, team: team.name, goals: member.goals });
          }
        });
      });
      setScorers(allScorers.sort((a, b) => b.goals - a.goals));
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Build standings — only from FINISHED matches, FIFA sort per group
  // Returns: Record<groupName, StandingRow[]>
  //   League mode  → { "League": [...all teams sorted] }
  //   Group Stage  → { "Group A": [...], "Group B": [...], ... }
  // ─────────────────────────────────────────────────────────────────────────
  const buildStandings = (): Record<string, StandingRow[]> => {
    // Initialise every team with zero stats
    const table: Record<string, StandingRow> = {};
    teams.forEach((t) => {
      table[t.name] = {
        team: t.name,
        played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, gd: 0, points: 0,
      };
    });

    // Only process FINISHED matches
    matches
      .filter((m) => FINISHED_STATUSES.has(m.status))
      .forEach((match) => {
        const t1 = table[match.team1];
        const t2 = table[match.team2];
        if (!t1 || !t2) return;

        const s1 = Number(match.score1) || 0;
        const s2 = Number(match.score2) || 0;

        t1.played += 1; t2.played += 1;
        t1.gf += s1;    t1.ga += s2;
        t2.gf += s2;    t2.ga += s1;

        if (s1 > s2)      { t1.won += 1; t2.lost += 1; t1.points += 3; }
        else if (s1 < s2) { t2.won += 1; t1.lost += 1; t2.points += 3; }
        else              { t1.drawn += 1; t2.drawn += 1; t1.points += 1; t2.points += 1; }
      });

    // Compute GD
    Object.values(table).forEach((r) => { r.gd = r.gf - r.ga; });

    // FIFA sort: Points → GD → GF → team name
    const fifaSort = (a: StandingRow, b: StandingRow): number => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd     !== a.gd)     return b.gd     - a.gd;
      if (b.gf     !== a.gf)     return b.gf     - a.gf;
      return a.team.localeCompare(b.team);
    };

    const isGroupStage = tournament.type === 'Group Stage';
    const groups = tournament.groups || {};

    if (!isGroupStage || Object.keys(groups).length === 0) {
      // League mode — single combined table
      return { League: Object.values(table).sort(fifaSort) };
    }

    // Group Stage: build one table per group using group membership from tournament config
    const byGroup: Record<string, StandingRow[]> = {};

    Object.keys(groups).forEach((groupName) => {
      const memberNames: string[] = Array.isArray(groups[groupName]) ? groups[groupName] : [];
      byGroup[groupName] = memberNames
        .map((name) => table[name])
        .filter(Boolean)
        .sort(fifaSort);
    });

    // Safety net: teams that have a match group but no tournament.groups entry
    // (derive groups from match.group field as fallback)
    const assignedTeams = new Set(Object.values(groups).flat());
    const unassigned = Object.values(table)
      .filter((r) => !assignedTeams.has(r.team))
      .sort(fifaSort);
    if (unassigned.length > 0) {
      byGroup['Other'] = unassigned;
    }

    return byGroup;
  };

  // ─────────────────────────────────────────────
  // Standings table component
  // ─────────────────────────────────────────────
  const StandingsTable = ({ rows, title }: { rows: StandingRow[]; title?: string }) => (
    <div className="mb-8">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-3 h-3 rounded-full bg-green-600" />
          <h3 className="font-bold text-green-800 text-base uppercase tracking-wide">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-green-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-green-700 text-white text-xs uppercase tracking-wider">
              <th className="text-center py-3 px-3 w-8">#</th>
              <th className="text-left py-3 px-3">Team</th>
              <th className="text-center py-3 px-2 w-10" title="Matches Played">P</th>
              <th className="text-center py-3 px-2 w-10" title="Won">W</th>
              <th className="text-center py-3 px-2 w-10" title="Drawn">D</th>
              <th className="text-center py-3 px-2 w-10" title="Lost">L</th>
              <th className="text-center py-3 px-2 w-12" title="Goals For">GF</th>
              <th className="text-center py-3 px-2 w-12" title="Goals Against">GA</th>
              <th className="text-center py-3 px-2 w-12" title="Goal Difference">GD</th>
              <th className="text-center py-3 px-2 w-12" title="Points">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-6 text-gray-400 text-sm">
                  No finished matches yet
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.team}
                  className={`border-b border-gray-100 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-green-50/40'
                  } hover:bg-green-50`}
                >
                  <td className="text-center py-3 px-3 font-semibold text-gray-400 text-xs">
                    {index + 1}
                  </td>
                  <td className="py-3 px-3 font-semibold text-gray-900">{row.team}</td>
                  <td className="text-center py-3 px-2 text-gray-600">{row.played}</td>
                  <td className="text-center py-3 px-2 font-medium text-green-700">{row.won}</td>
                  <td className="text-center py-3 px-2 font-medium text-amber-600">{row.drawn}</td>
                  <td className="text-center py-3 px-2 font-medium text-red-600">{row.lost}</td>
                  <td className="text-center py-3 px-2 text-gray-600">{row.gf}</td>
                  <td className="text-center py-3 px-2 text-gray-600">{row.ga}</td>
                  <td className={`text-center py-3 px-2 font-semibold ${
                    row.gd > 0 ? 'text-green-700' : row.gd < 0 ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {row.gd > 0 ? `+${row.gd}` : row.gd}
                  </td>
                  <td className="text-center py-3 px-2 font-bold text-blue-700 text-base">
                    {row.points}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <p className="text-xl text-gray-600">Loading tournament data...</p>
      </div>
    );
  }

  const isGroupStage = tournament.type === 'Group Stage';
  const standingsByGroup = buildStandings();
  const groupEntries = Object.entries(standingsByGroup);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-green-900">⚽ Tournament Information</h1>
            <p className="text-gray-600 mt-2">View fixtures, standings, and statistics</p>
          </div>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </div>

        <Tabs defaultValue="fixtures" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="fixtures">⚽ Fixtures</TabsTrigger>
            <TabsTrigger value="standings">📊 Standings</TabsTrigger>
            <TabsTrigger value="scorers">🥅 Top Scorers</TabsTrigger>
            <TabsTrigger value="teams">👥 Teams</TabsTrigger>
          </TabsList>

          {/* ── Fixtures ── */}
          <TabsContent value="fixtures" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tournament Fixtures</CardTitle>
                <CardDescription>Total matches: {matches.length}</CardDescription>
              </CardHeader>
              <CardContent>
                {matches.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No matches scheduled yet</p>
                ) : (
                  <div className="space-y-3">
                    {matches.map((match) => {
                      const isFinished = FINISHED_STATUSES.has(match.status);
                      return (
                        <div
                          key={match._id}
                          className={`p-4 rounded-xl border ${
                            isFinished
                              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                              : 'bg-gradient-to-r from-slate-50 to-blue-50 border-blue-100'
                          }`}
                        >
                          {match.group && (
                            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-widest">
                              {match.group}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="text-right flex-1">
                              <p className="font-semibold text-lg">{match.team1}</p>
                            </div>
                            <div className="mx-6 text-center min-w-[90px]">
                              <p className="text-2xl font-bold text-blue-600">
                                {match.score1} – {match.score2}
                              </p>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${
                                isFinished
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                {isFinished ? '✅ Final' : '🕐 Upcoming'}
                              </span>
                            </div>
                            <div className="text-left flex-1">
                              <p className="font-semibold text-lg">{match.team2}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Standings ── */}
          <TabsContent value="standings">
            <Card>
              <CardHeader>
                <CardTitle>
                  {isGroupStage ? '📊 Group Stage Standings' : '📊 League Standings'}
                </CardTitle>
                <CardDescription>
                  {/*Only <strong>finished</strong> matches are counted • Sorted by Points → GD → GF*/}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {teams.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No teams added yet</p>
                ) : groupEntries.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No standings data available</p>
                ) : (
                  groupEntries.map(([groupName, rows]) => (
                    <StandingsTable
                      key={groupName}
                      title={isGroupStage ? groupName : undefined}
                      rows={rows}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Top Scorers ── */}
          <TabsContent value="scorers">
            <Card>
              <CardHeader>
                <CardTitle>Top Goal Scorers</CardTitle>
                {/*<CardDescription>Top {Math.min(10, scorers.length)} scorers</CardDescription>*/}
              </CardHeader>
              <CardContent>
                {scorers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No goal data available</p>
                ) : (
                  <div className="space-y-3">
                    {scorers.slice(0, 10).map((scorer, index) => (
                      <div
                        key={`${scorer.name}-${scorer.team}`}
                        className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                      >
                        <div className="flex items-center">
                          <span className="text-xl font-bold text-yellow-600 mr-4 w-8 text-center">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-semibold">{scorer.name}</p>
                            <p className="text-sm text-gray-600">{scorer.team}</p>
                          </div>
                        </div>
                        <span className="text-2xl font-bold text-red-600">⚽ {scorer.goals}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Teams ── */}
          <TabsContent value="teams" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (
                <Card key={team._id}>
                  <CardHeader>
                    <CardTitle>{team.name}</CardTitle>
                    {team.manager && <CardDescription>Manager: {team.manager}</CardDescription>}
                    {team.group   && <CardDescription>Group: {team.group}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        <strong>Players:</strong> {team.members?.length || 0}
                      </p>
                      {team.members && team.members.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Squad</p>
                          <div className="space-y-1">
                            {team.members.slice(0, 6).map((member) => (
                              <p key={member._id} className="text-xs text-gray-600">
                                • {member.name} {member.goals > 0 && `(${member.goals}g)`}
                              </p>
                            ))}
                            {team.members.length > 6 && (
                              <p className="text-xs text-gray-500">+{team.members.length - 6} more</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
