import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Fab,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  Autocomplete,
  useTheme,
  useMediaQuery,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Notifications as NotificationIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useInView } from 'react-intersection-observer';

import type { Match, Club } from '../types';
import { MatchStatus, MatchType } from '../types';
import { getMatches } from '../api/matches';
import { getClubs } from '../api/clubs';
import { useAuth } from '../contexts/AuthContext';
import { useCanModify, useCanCreateMatch } from '../hooks/useCanModify';
import { offlineService } from '../services/offlineService';
import notificationService from '../services/notificationService';
import realtimeService from '../services/realtimeService';
import { EmptyState } from '../components/EmptyState';
import CreateMatchDialog from '../components/CreateMatchDialog';
import { getMatchNotifications, getNotificationLabel } from '../utils/matchNotifications';
import { getMatchStatusColor, getMatchStatusLabel, getMatchTypeColor, getMatchTypeLabel } from '../utils/colorUtils';

const ITEMS_PER_PAGE = 20;

interface Filters {
  clubId?: string;
  status?: MatchStatus;
  type?: MatchType;
  startDate?: string;
  endDate?: string;
  myMatches: boolean;
}

export default function MatchesListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { user } = useAuth();
  const canModify = useCanModify();
  const canCreateMatch = useCanCreateMatch();

  const [matches, setMatches] = useState<Match[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [pinnedMatchIds, setPinnedMatchIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    myMatches: false,
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.5,
  });

  const pullStartY = useRef<number | null>(null);
  const pullDistance = useRef(0);

  // Load clubs for filter
  useEffect(() => {
    const loadClubs = async () => {
      try {
        const response = await getClubs({ page: 1, limit: 100 });
        setClubs(response.data);
      } catch (err) {
        console.error('Failed to load clubs:', err);
      }
    };
    loadClubs();
  }, []);

  // Load pinned matches on mount
  useEffect(() => {
    const loadPinned = async () => {
      try {
        const pinned = await offlineService.getPinnedMatches();
        setPinnedMatchIds(new Set(pinned.map((m: any) => m.id || m._id)));
      } catch (err) {
        console.error('Failed to load pinned matches:', err);
      }
    };
    loadPinned();
  }, []);

  // Load matches
  const loadMatches = useCallback(async (pageNum: number, reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const params: any = {
        page: pageNum,
        limit: ITEMS_PER_PAGE,
      };

      if (filters.clubId) params.clubId = filters.clubId;
      if (filters.status) params.status = filters.status;
      if (filters.type) params.type = filters.type;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.myMatches && user) params.playerId = user._id || user.id;

      const response = await getMatches(params);

      // Use the matches as-is from the API (no need for validation since we're only using basic fields)
      if (reset) {
        setMatches(response.data);
      } else {
        setMatches(prev => [...prev, ...response.data]);
      }

      setHasMore(response.pagination.currentPage < response.pagination.totalPages);
      setPage(pageNum);
    } catch (err: any) {
      console.error('Failed to load matches:', err);
      setError(err.response?.data?.message || 'Failed to load matches');
      notificationService.error('Failed to load matches');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [filters, user]);

  // Initial load
  useEffect(() => {
    loadMatches(1, true);
  }, [loadMatches]);

  // Infinite scroll
  useEffect(() => {
    if (inView && hasMore && !loading && !loadingMore) {
      loadMatches(page + 1);
    }
  }, [inView, hasMore, loading, loadingMore, page, loadMatches]);

  // Real-time match updates
  useEffect(() => {
    if (!user) return;

    realtimeService.connect();

    const handleMatchCreated = (message: any) => {
      if (!message.data?.match) return;
      
      // Add new match to the beginning of the list
      setMatches((prev) => [message.data.match, ...prev]);
      notificationService.info(`New match created: ${message.data.match.name}`);
    };

    const handleMatchUpdated = (message: any) => {
      if (!message.data?.match) return;

      // Update existing match in the list
      setMatches((prev) =>
        prev.map((m) =>
          (m._id || m.id) === (message.data.match._id || message.data.match.id)
            ? message.data.match
            : m
        )
      );
    };

    const unsubscribeCreated = realtimeService.onMatchCreated(handleMatchCreated);
    const unsubscribeUpdated = realtimeService.onMatchUpdated(handleMatchUpdated);

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, [user]);

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY.current !== null) {
      const currentY = e.touches[0].clientY;
      pullDistance.current = currentY - pullStartY.current;

      if (pullDistance.current > 80 && !refreshing) {
        handleRefresh();
      }
    }
  };

  const handleTouchEnd = () => {
    pullStartY.current = null;
    pullDistance.current = 0;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMatches(1, true);
  };

  const handlePinToggle = async (match: Match) => {
    try {
      const matchId = match.id || match._id;
      if (!matchId) return;
      
      const isPinned = pinnedMatchIds.has(matchId);
      
      if (isPinned) {
        await offlineService.unpinMatch(matchId);
        setPinnedMatchIds(prev => {
          const next = new Set(prev);
          next.delete(matchId);
          return next;
        });
        notificationService.info('Match unpinned');
      } else {
        await offlineService.pinMatch(match);
        setPinnedMatchIds(prev => new Set(prev).add(matchId));
        notificationService.success('Match pinned for offline access');
      }
    } catch (err: any) {
      console.error('Failed to toggle pin:', err);
      notificationService.error(err.message || 'Failed to pin match');
    }
  };

  if (loading && matches.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{ pb: 10 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          p: 2,
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" component="h1">
            Matches
          </Typography>
          <Box>
            <IconButton onClick={() => setShowFilters(!showFilters)} color={showFilters ? 'primary' : 'default'}>
              <FilterIcon />
            </IconButton>
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </Box>
        </Box>

        {/* Filters */}
        {showFilters && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={filters.myMatches}
                  onChange={(e) => setFilters({ ...filters, myMatches: e.target.checked })}
                />
              }
              label="My Matches Only"
            />

            <Autocomplete
              options={clubs}
              getOptionLabel={(club) => club.name}
              value={clubs.find(c => (c._id || c.id) === filters.clubId) || null}
              onChange={(_, club) => setFilters({ ...filters, clubId: club?._id || club?.id })}
              renderInput={(params) => <TextField {...params} label="Club" size="small" />}
              fullWidth
            />

            <TextField
              select
              label="Status"
              size="small"
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as MatchStatus || undefined })}
              fullWidth
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value={MatchStatus.SCHEDULED}>Scheduled</MenuItem>
              <MenuItem value={MatchStatus.LIVE}>Live</MenuItem>
              <MenuItem value={MatchStatus.COMPLETED}>Completed</MenuItem>
              <MenuItem value={MatchStatus.CANCELLED}>Cancelled</MenuItem>
            </TextField>

            <TextField
              select
              label="Type"
              size="small"
              value={filters.type || ''}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as MatchType || undefined })}
              fullWidth
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value={MatchType.TRAINING}>Training</MenuItem>
              <MenuItem value={MatchType.COMPETITIVE}>Competitive</MenuItem>
            </TextField>
          </Box>
        )}
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Matches List */}
      <Box sx={{ p: 2 }}>
        {matches.length === 0 ? (
          <EmptyState
            title="No Matches Yet"
            description="Get started by creating your first match or wait for upcoming matches to be scheduled."
            actionLabel={canCreateMatch ? "Create Match" : undefined}
            onAction={canModify ? () => navigate('/matches/new') : undefined}
            showAction={canModify}
          />
        ) : (
          matches.map((match) => {
            const isPinned = pinnedMatchIds.has(match._id || match.id);
            const notifications = getMatchNotifications(match, user?._id || user?.id);
            const notificationLabel = getNotificationLabel(notifications);

            // Debug logging for notification detection
            if ((match._id || match.id) === 'your-match-id-here' || match.name === 'test2') {
              console.log("🔍 Match card rendering:", {
                matchId: match._id || match.id,
                matchName: match.name,
                matchStatus: match.status,
                userId: user?._id || user?.id,
                notifications,
                notificationLabel,
                teams: match.teams,
              });
            }

            return (
              <Card
                key={match._id || match.id}
                sx={{
                  mb: 2,
                  cursor: 'pointer',
                  position: 'relative',
                  '&:hover': {
                    boxShadow: 4,
                  },
                }}
                onClick={() => navigate(`/matches/${match._id || match.id}`)}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="h6" component="h2">
                          {match.name}
                        </Typography>
                        {notificationLabel && (
                          <Badge
                            badgeContent={notifications.totalPending || '!'}
                            color={notifications.canStart ? "success" : "warning"}
                            sx={{ ml: 0.5 }}
                          >
                            <NotificationIcon 
                              color="action" 
                              fontSize="small"
                            />
                          </Badge>
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {format(new Date(match.scheduledAt || match.matchDate), 'PPp')}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePinToggle(match);
                      }}
                      color={isPinned ? 'primary' : 'default'}
                    >
                      {isPinned ? <PinIcon /> : <PinOutlinedIcon />}
                    </IconButton>
                  </Box>

                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip
                      label={getMatchStatusLabel(match.status)}
                      color={getMatchStatusColor(match.status)}
                      size="small"
                    />
                    <Chip
                      label={getMatchTypeLabel(match.type || match.matchType)}
                      color={getMatchTypeColor(match.type || match.matchType)}
                      variant="outlined"
                      size="small"
                    />
                    {notificationLabel && (
                      <Chip
                        label={notificationLabel}
                        color={notifications.canStart ? "success" : "warning"}
                        size="small"
                        icon={<NotificationIcon />}
                      />
                    )}
                    {match.status === MatchStatus.COMPLETED && match.winnerTeam && (
                      <Chip
                        label={`Winner: Team ${match.winnerTeam}`}
                        color="success"
                        size="small"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })
        )}

        {/* Load More Trigger */}
        {hasMore && (
          <Box ref={loadMoreRef} display="flex" justifyContent="center" py={2}>
            {loadingMore && <CircularProgress />}
          </Box>
        )}
      </Box>

      {/* Create Match FAB */}
      {canCreateMatch && (
        <Fab
          color="primary"
          aria-label="create match"
          sx={{
            position: 'fixed',
            bottom: isMobile ? 72 : 16,
            right: 16,
          }}
          onClick={() => setCreateDialogOpen(true)}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Create Match Dialog */}
      <CreateMatchDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => {
          // Refresh matches list after successful creation
          setPage(1);
          setMatches([]);
          loadMatches(1);
        }}
      />
    </Box>
  );
}
