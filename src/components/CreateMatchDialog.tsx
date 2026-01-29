import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Autocomplete,
  Alert,
  CircularProgress,
  Typography,
  Box,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { createMatch } from '../api/matches';
import { getClubs, getClubById } from '../api/clubs';
import { getPlayerById } from '../api/players';
import type { Club, Player, ClubMemberRole } from '../types';
import { ClubMemberRole as ClubRole } from '../types';
import notificationService from '../services/notificationService';

interface CreateMatchDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PlayerWithClub extends Player {
  clubName?: string;
}

export default function CreateMatchDialog({ open, onClose, onSuccess }: CreateMatchDialogProps) {
  const { user } = useAuth();
  
  // Form state
  const [matchName, setMatchName] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [description, setDescription] = useState('');
  
  // Team 1
  const [team1Name, setTeam1Name] = useState('');
  const [team1Club, setTeam1Club] = useState<Club | null>(null);
  const [team1Captain, setTeam1Captain] = useState<Player | null>(null);
  
  // Team 2
  const [team2Name, setTeam2Name] = useState('');
  const [team2Club, setTeam2Club] = useState<Club | null>(null);
  const [team2Captain, setTeam2Captain] = useState<Player | null>(null);

  // Data
  const [clubs, setClubs] = useState<Club[]>([]);
  const [team1AvailableCaptains, setTeam1AvailableCaptains] = useState<PlayerWithClub[]>([]);
  const [team2AvailableCaptains, setTeam2AvailableCaptains] = useState<PlayerWithClub[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUserClubOwner, setIsUserClubOwner] = useState(false);

  // Load clubs and auto-populate Team 1 for club owners
  useEffect(() => {
    if (open) {
      loadClubsAndAutoPopulate();
      // Clear captain lists - require club selection
      setTeam1AvailableCaptains([]);
      setTeam2AvailableCaptains([]);
    }
  }, [open]);
  
  const loadClubsAndAutoPopulate = async () => {
    try {
      setLoadingClubs(true);
      const response = await getClubs({ status: 'approved', limit: 100 });
      setClubs(response.data);
      
      // After clubs are loaded, check if user is owner and auto-populate
      await autoPopulateTeam1ForOwner(response.data);
    } catch (err) {
      console.error('Failed to load clubs:', err);
      notificationService.error('Failed to load clubs');
    } finally {
      setLoadingClubs(false);
    }
  };
  
  const autoPopulateTeam1ForOwner = async (clubsList: Club[]) => {
    if (!user) return;
    
    console.log('Checking if user is club owner...');
    console.log('User clubs raw:', user.clubs);
    console.log('User clubs JSON:', JSON.stringify(user.clubs, null, 2));
    
    // Check if user has clubs with owner role
    const userId = user._id || user.id;
    const ownedClubs = Array.isArray(user.clubs) ? user.clubs.filter((clubData: any) => {
      console.log('Checking club:', clubData.name);
      
      // Structure: Club object with members array
      // members: [{ playerId: string, role: 'owner'|'co_owner'|'member', joinedAt: string }]
      if (Array.isArray(clubData.members)) {
        const userMembership = clubData.members.find((m: any) => 
          (m.playerId === userId) && (m.role === 'owner' || m.role === ClubRole.OWNER)
        );
        
        console.log('  User membership:', userMembership);
        
        if (userMembership) {
          console.log('  ✅ User is OWNER of', clubData.name);
          return true;
        }
      }
      
      return false;
    }) : [];
    
    console.log('Owned clubs:', ownedClubs);
    
    if (ownedClubs.length > 0) {
      // User is a club owner - auto-populate Team 1 with their first owned club
      setIsUserClubOwner(true);
      const ownedClubData = ownedClubs[0];
      
      console.log('User is club owner! Auto-populating Team 1');
      console.log('Owned club data:', ownedClubData);
      
      // Structure: Club object with memberRole at top level
      // { ...Club, memberRole: 'owner', joinedAt: string }
      let clubToUse: any;
      
      if (ownedClubData.club) {
        // PlayerClubMembership structure - extract the club
        clubToUse = ownedClubData.club;
      } else if (ownedClubData._id || ownedClubData.id) {
        // Direct Club object - use it directly
        clubToUse = ownedClubData;
      }
      
      if (clubToUse) {
        console.log('Setting Team 1 club to:', clubToUse.name);
        setTeam1Club(clubToUse);
        setTeam1Name(clubToUse.name);
      } else {
        console.error('Could not extract club from owned clubs data');
        setIsUserClubOwner(false);
      }
    } else {
      console.log('User is NOT a club owner');
      setIsUserClubOwner(false);
    }
  };

  // Load captains when club is selected
  useEffect(() => {
    if (team1Club) {
      loadClubCaptains(team1Club.id || team1Club._id!, 1);
      // Auto-fill team name with club name
      if (!team1Name) {
        setTeam1Name(team1Club.name);
      }
    } else {
      // Clear captains if no club selected
      setTeam1AvailableCaptains([]);
      setTeam1Captain(null);
    }
  }, [team1Club]);

  useEffect(() => {
    if (team2Club) {
      loadClubCaptains(team2Club.id || team2Club._id!, 2);
      // Auto-fill team name with club name
      if (!team2Name) {
        setTeam2Name(team2Club.name);
      }
    } else {
      // Clear captains if no club selected
      setTeam2AvailableCaptains([]);
      setTeam2Captain(null);
    }
  }, [team2Club]);

  const loadClubCaptains = async (clubId: string, team: 1 | 2) => {
    try {
      console.log(`Loading captains for club ${clubId}, team ${team}`);
      
      // Fetch club to get player IDs
      const club = await getClubById(clubId, false);
      console.log('Club data:', club);
      
      // Get player IDs from the club
      const playerIds = Array.isArray(club.players) 
        ? club.players.map(p => typeof p === 'string' ? p : (p._id || p.id)) 
        : [];
      
      console.log(`Found ${playerIds.length} player IDs:`, playerIds);
      
      if (playerIds.length === 0) {
        console.warn('No players found in club');
        if (team === 1) {
          setTeam1AvailableCaptains([]);
        } else {
          setTeam2AvailableCaptains([]);
        }
        return;
      }
      
      // Fetch each player's details
      const playerPromises = playerIds.map(id => 
        getPlayerById(id as string).catch(err => {
          console.error(`Failed to fetch player ${id}:`, err);
          return null;
        })
      );
      
      const playersResults = await Promise.all(playerPromises);
      const clubPlayers = playersResults.filter((p): p is Player => p !== null);
      
      console.log(`Fetched ${clubPlayers.length} players for captain selection:`, clubPlayers.map(p => p.name));

      const playersWithClub = clubPlayers.map(p => ({
        ...p,
        clubName: club.name
      }));

      if (team === 1) {
        setTeam1AvailableCaptains(playersWithClub);
        // Clear captain if not in new club
        if (team1Captain && !playersWithClub.find(p => (p._id || p.id) === (team1Captain._id || team1Captain.id))) {
          setTeam1Captain(null);
        }
      } else {
        setTeam2AvailableCaptains(playersWithClub);
        // Clear captain if not in new club
        if (team2Captain && !playersWithClub.find(p => (p._id || p.id) === (team2Captain._id || team2Captain.id))) {
          setTeam2Captain(null);
        }
      }
    } catch (err) {
      console.error('Failed to load club captains:', err);
      notificationService.error('Failed to load captains');
    }
  };

  const handleSubmit = async () => {
    console.log('🚀 handleSubmit called');
    console.log('Form state:', {
      matchName,
      matchDate,
      team1Name,
      team1Club: team1Club?.name,
      team1Captain: team1Captain?.name,
      team2Name,
      team2Club: team2Club?.name,
      team2Captain: team2Captain?.name,
    });

    // Validation
    if (!matchName.trim()) {
      console.log('❌ Validation failed: Match name is required');
      setError('Match name is required');
      return;
    }
    if (!matchDate) {
      console.log('❌ Validation failed: Match date is required');
      setError('Match date is required');
      return;
    }
    if (!team1Name.trim() || !team2Name.trim()) {
      console.log('❌ Validation failed: Both team names are required');
      setError('Both team names are required');
      return;
    }
    if (!team1Club || !team2Club) {
      console.log('❌ Validation failed: Both teams must select a club');
      setError('Both teams must select a club');
      return;
    }
    if (!team1Captain || !team2Captain) {
      console.log('❌ Validation failed: Both teams must have a captain');
      setError('Both teams must have a captain');
      return;
    }

    console.log('✅ All validations passed, proceeding with API call...');
    console.log('Current user:', user);
    console.log('User ID:', user?._id, user?.id);
    console.log('User status:', user?.status);
    
    // Verify token exists
    const token = localStorage.getItem('token');
    console.log('Token exists:', !!token);
    console.log('Token preview:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

    try {
      setLoading(true);
      setError(null);

      // Get the organizer ID - use the authenticated user's ID
      const organizerId = user?._id || user?.id;
      if (!organizerId) {
        console.error('❌ No user ID found!');
        setError('User not authenticated properly. Please log out and log back in.');
        setLoading(false);
        return;
      }

      console.log('Using organizer ID:', organizerId);

      const matchData = {
        name: matchName.trim(),
        matchDate: new Date(matchDate).toISOString(),
        organizerId: organizerId,
        description: description.trim() || undefined,
        team1: {
          teamName: team1Name.trim(),
          captainId: team1Captain._id || team1Captain.id!,
          clubId: team1Club._id || team1Club.id,
        },
        team2: {
          teamName: team2Name.trim(),
          captainId: team2Captain._id || team2Captain.id!,
          clubId: team2Club._id || team2Club.id,
        },
      };

      console.log('📤 Creating match with data:', matchData);

      await createMatch(matchData);
      
      console.log('✅ Match created successfully!');

      notificationService.success('Match created successfully!');
      handleClose();
      onSuccess();
    } catch (err: any) {
      console.error('❌ Failed to create match:', err);
      console.error('Error response:', err.response?.data);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create match';
      setError(errorMsg);
      notificationService.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form
      setMatchName('');
      setMatchDate('');
      setDescription('');
      setTeam1Name('');
      setTeam1Club(null);
      setTeam1Captain(null);
      setTeam2Name('');
      setTeam2Club(null);
      setTeam2Captain(null);
      setError(null);
      setIsUserClubOwner(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Match</DialogTitle>
      <DialogContent dividers sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Match Details Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary" sx={{ mb: 2 }}>
            Match Details
          </Typography>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Match Name"
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                required
                disabled={loading}
                margin="dense"
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label="Match Date & Time"
                type="datetime-local"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                required
                disabled={loading}
                margin="dense"
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label="Description (Optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={2}
                disabled={loading}
                margin="dense"
              />
            </Grid>
          </Grid>
        </Box>

        {/* Team 1 Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary" sx={{ mb: 2 }}>
            Team 1 {isUserClubOwner && '(Your Club)'}
          </Typography>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Team 1 Name"
                value={team1Name}
                onChange={(e) => setTeam1Name(e.target.value)}
                required
                disabled={loading || isUserClubOwner}
                margin="dense"
              />
            </Grid>

            <Grid size={12}>
              <Autocomplete
                options={clubs}
                getOptionLabel={(option) => option.name}
                value={team1Club}
                onChange={(_, newValue) => {
                  setTeam1Club(newValue);
                  setTeam1Captain(null);
                  if (newValue) {
                    setTeam1Name(newValue.name);
                  }
                }}
                disabled={loading || loadingClubs || isUserClubOwner}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={isUserClubOwner ? "Your Club (Auto-selected)" : "Select Club"}
                    placeholder="Choose a club"
                    margin="dense"
                    required
                  />
                )}
              />
            </Grid>

            <Grid size={12}>
              <Autocomplete
                options={team1AvailableCaptains}
                getOptionLabel={(option) => option.name}
                value={team1Captain}
                onChange={(_, newValue) => setTeam1Captain(newValue)}
                disabled={loading || !team1Club}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Captain"
                    required
                    placeholder={team1Club ? "Select captain" : "Select club first"}
                    margin="dense"
                  />
                )}
              />
            </Grid>
            
            <Grid size={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                ℹ️ All club members will be automatically added as participants
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Team 2 Section */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary" sx={{ mb: 2 }}>
            Team 2
          </Typography>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Team 2 Name"
                value={team2Name}
                onChange={(e) => setTeam2Name(e.target.value)}
                required
                disabled={loading}
                margin="dense"
              />
            </Grid>

            <Grid size={12}>
              <Autocomplete
                options={clubs}
                getOptionLabel={(option) => option.name}
                value={team2Club}
                onChange={(_, newValue) => {
                  setTeam2Club(newValue);
                  setTeam2Captain(null);
                  if (newValue) {
                    setTeam2Name(newValue.name);
                  }
                }}
                disabled={loading || loadingClubs}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Club"
                    placeholder="Choose a club"
                    margin="dense"
                    required
                  />
                )}
              />
            </Grid>

            <Grid size={12}>
              <Autocomplete
                options={team2AvailableCaptains}
                getOptionLabel={(option) => option.name}
                value={team2Captain}
                onChange={(_, newValue) => setTeam2Captain(newValue)}
                disabled={loading || !team2Club}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Captain"
                    required
                    placeholder={team2Club ? "Select captain" : "Select club first"}
                    margin="dense"
                  />
                )}
              />
            </Grid>
            
            <Grid size={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                ℹ️ All club members will be automatically added as participants
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={loading} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Creating...' : 'Create Match'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
