import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Tabs,
  Tab,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Badge,
  Alert,
  CircularProgress,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  Gavel as DisputeIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

import type { Player, Club, Fight, Match } from '../types';
import { FightStatus } from '../types';
import {
  getPendingPlayers,
  approvePlayer,
  rejectPlayer,
  getPendingClubs,
  approveClub,
  rejectClub,
  resolveFightDispute,
} from '../api/admin';
import { getFights } from '../api/fights';
import { getMatches } from '../api/matches';
import { useAuth } from '../contexts/AuthContext';
import socketService from '../services/socketService';
import notificationService from '../services/notificationService';
import CreateClubDialog from '../components/CreateClubDialog';

type TabValue = 'players' | 'clubs' | 'fights' | 'matches';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabValue>('players');
  const [pendingPlayers, setPendingPlayers] = useState<Player[]>([]);
  const [pendingClubs, setPendingClubs] = useState<Club[]>([]);
  const [disputedFights, setDisputedFights] = useState<Fight[]>([]);
  const [disputedMatches, setDisputedMatches] = useState<Match[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<{ type: 'player' | 'club'; id: string } | null>(null);
  const [createClubDialogOpen, setCreateClubDialogOpen] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      notificationService.error('Admin access required');
      navigate('/matches');
    }
  }, [user, navigate]);

  // Load data
  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Socket.io real-time updates
  useEffect(() => {
    socketService.connect();
    socketService.joinAdminRoom();

    const unsubPendingPlayer = socketService.onPendingPlayerAdded(() => {
      if (activeTab === 'players') loadData();
    });

    const unsubPendingClub = socketService.onPendingClubAdded(() => {
      if (activeTab === 'clubs') loadData();
    });

    const unsubFightDisputed = socketService.onFightDisputed(() => {
      if (activeTab === 'fights') loadData();
    });

    return () => {
      unsubPendingPlayer();
      unsubPendingClub();
      unsubFightDisputed();
      socketService.leaveAdminRoom();
    };
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      switch (activeTab) {
        case 'players': {
          const players = await getPendingPlayers();
          setPendingPlayers(players.data);
          break;
        }
        case 'clubs': {
          const clubs = await getPendingClubs();
          setPendingClubs(clubs.data);
          break;
        }
        case 'fights': {
          const fightsResponse = await getFights({ status: FightStatus.DISPUTED });
          setDisputedFights(fightsResponse.data);
          break;
        }
        case 'matches': {
          const matchesResponse = await getMatches({ status: 'DISPUTED' as any });
          setDisputedMatches(matchesResponse.data);
          break;
        }
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setError(err.response?.data?.message || 'Failed to load data');
      notificationService.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePlayer = async (playerId: string) => {
    try {
      await approvePlayer(playerId);
      notificationService.success('Player approved');
      setPendingPlayers(prev => prev.filter(p => (p._id || p.id) !== playerId));
    } catch (err: any) {
      notificationService.error(err.response?.data?.message || 'Failed to approve player');
    }
  };

  const handleRejectPlayer = async () => {
    if (!rejectTarget || rejectTarget.type !== 'player') return;

    try {
      await rejectPlayer(rejectTarget.id, rejectReason);
      notificationService.success('Player rejected');
      setPendingPlayers(prev => prev.filter(p => (p._id || p.id) !== rejectTarget.id));
      setRejectDialogOpen(false);
      setRejectReason('');
      setRejectTarget(null);
    } catch (err: any) {
      notificationService.error(err.response?.data?.message || 'Failed to reject player');
    }
  };

  const handleApproveClub = async (clubId: string) => {
    try {
      await approveClub(clubId);
      notificationService.success('Club approved');
      setPendingClubs(prev => prev.filter(c => (c._id || c.id) !== clubId));
    } catch (err: any) {
      notificationService.error(err.response?.data?.message || 'Failed to approve club');
    }
  };

  const handleRejectClub = async () => {
    if (!rejectTarget || rejectTarget.type !== 'club') return;

    try {
      await rejectClub(rejectTarget.id, rejectReason);
      notificationService.success('Club rejected');
      setPendingClubs(prev => prev.filter(c => (c._id || c.id) !== rejectTarget.id));
      setRejectDialogOpen(false);
      setRejectReason('');
      setRejectTarget(null);
    } catch (err: any) {
      notificationService.error(err.response?.data?.message || 'Failed to reject club');
    }
  };

  const handleResolveFightDispute = async (fightId: string, resolution: 'confirm' | 'cancel') => {
    try {
      await resolveFightDispute(fightId, resolution);
      notificationService.success('Fight dispute resolved');
      setDisputedFights(prev => prev.filter(f => f.id !== fightId));
    } catch (err: any) {
      notificationService.error(err.response?.data?.message || 'Failed to resolve dispute');
    }
  };

  if (loading && activeTab === 'players' && pendingPlayers.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      {/* Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => navigate('/matches')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" flex={1}>
            Admin Dashboard
          </Typography>
        </Box>

        {/* Mobile Warning */}
        {isMobile && (
          <Alert severity="warning" sx={{ m: 2 }}>
            Admin dashboard is best viewed on desktop
          </Alert>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant={isMobile ? 'scrollable' : 'fullWidth'}
          scrollButtons="auto"
        >
          <Tab
            label={
              <Badge badgeContent={pendingPlayers.length} color="error">
                Players
              </Badge>
            }
            value="players"
          />
          <Tab
            label={
              <Badge badgeContent={pendingClubs.length} color="error">
                Clubs
              </Badge>
            }
            value="clubs"
          />
          <Tab
            label={
              <Badge badgeContent={disputedFights.length} color="warning">
                Fight Disputes
              </Badge>
            }
            value="fights"
          />
          <Tab
            label={
              <Badge badgeContent={disputedMatches.length} color="warning">
                Match Disputes
              </Badge>
            }
            value="matches"
          />
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Pending Players */}
        {activeTab === 'players' && (
          <>
            {pendingPlayers.length === 0 ? (
              <Alert severity="info">No pending player approvals</Alert>
            ) : (
              pendingPlayers.map(player => (
                <Card key={player._id || player.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar>{player.name.charAt(0).toUpperCase()}</Avatar>
                      <Box flex={1}>
                        <Typography variant="h6">{player.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {player.email}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Registered: {format(new Date(player.createdAt), 'PPp')}
                        </Typography>
                      </Box>
                      <Box display="flex" gap={1}>
                        <IconButton
                          color="success"
                          onClick={() => handleApprovePlayer(player._id || player.id)}
                        >
                          <ApproveIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => {
                            setRejectTarget({ type: 'player', id: player._id || player.id });
                            setRejectDialogOpen(true);
                          }}
                        >
                          <RejectIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {/* Pending Clubs */}
        {activeTab === 'clubs' && (
          <>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Club Management</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateClubDialogOpen(true)}
              >
                Create Club
              </Button>
            </Box>
            
            {pendingClubs.length === 0 ? (
              <Alert severity="info">No pending club approvals</Alert>
            ) : (
              pendingClubs.map(club => (
                <Card key={club._id || club.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Box flex={1}>
                        <Typography variant="h6">{club.name}</Typography>
                        {club.description && (
                          <Typography variant="body2" color="text.secondary">
                            {club.description}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          Created: {format(new Date(club.createdAt), 'PPp')}
                        </Typography>
                      </Box>
                      <Box display="flex" gap={1}>
                        <IconButton
                          color="success"
                          onClick={() => handleApproveClub(club._id || club.id)}
                        >
                          <ApproveIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => {
                            setRejectTarget({ type: 'club', id: club._id || club.id });
                            setRejectDialogOpen(true);
                          }}
                        >
                          <RejectIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {/* Disputed Fights */}
        {activeTab === 'fights' && (
          <>
            {disputedFights.length === 0 ? (
              <Alert severity="info">No disputed fights</Alert>
            ) : (
              disputedFights.map(fight => (
                <Card key={fight._id || fight.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <DisputeIcon color="warning" />
                      <Typography variant="h6">Fight Dispute</Typography>
                    </Box>
                    <Typography variant="body2" gutterBottom>
                      {fight.team1Player.name} vs {fight.team2Player.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Reported: {format(new Date(fight.reportedAt), 'PPp')}
                    </Typography>
                    <Box display="flex" gap={1} mt={2}>
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<ApproveIcon />}
                        onClick={() => handleResolveFightDispute(fight.id, 'confirm')}
                      >
                        Confirm Result
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<RejectIcon />}
                        onClick={() => handleResolveFightDispute(fight.id, 'cancel')}
                      >
                        Cancel Fight
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {/* Disputed Matches */}
        {activeTab === 'matches' && (
          <>
            {disputedMatches.length === 0 ? (
              <Alert severity="info">No disputed matches</Alert>
            ) : (
              <Alert severity="info">Match dispute resolution coming soon</Alert>
            )}
          </>
        )}
      </Box>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject {rejectTarget?.type}</DialogTitle>
        <DialogContent>
          <TextField
            label="Reason for rejection"
            multiline
            rows={3}
            fullWidth
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={rejectTarget?.type === 'player' ? handleRejectPlayer : handleRejectClub}
            disabled={!rejectReason.trim()}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Club Dialog */}
      <CreateClubDialog
        open={createClubDialogOpen}
        onClose={() => setCreateClubDialogOpen(false)}
        onSuccess={() => {
          loadData();
        }}
      />
    </Box>
  );
}
