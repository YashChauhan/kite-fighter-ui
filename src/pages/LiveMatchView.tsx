import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Snackbar,
  Divider,
  useTheme,
  useMediaQuery,
  Button,
  Drawer,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  Wifi as ConnectedIcon,
  WifiOff as DisconnectedIcon,
  Add as AddIcon,
  CheckCircle as ConfirmIcon,
  Cancel as DeclineIcon,
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  SwapHoriz as SwapHorizIcon,
  ManageAccounts as ManageAccountsIcon,
} from "@mui/icons-material";
import { format } from "date-fns";

import type { Match, Fight, Player, Club } from "../types";
import { FightStatus, MatchStatus } from "../types";
import {
  getMatchById,
  confirmParticipation,
  declineParticipation,
  startMatch,
  declareWinner,
} from "../api/matches";
import { getFights } from "../api/fights";
import { getClubById } from "../api/clubs";
import { useAuth } from "../contexts/AuthContext";
import socketService from "../services/socketService";
import notificationService from "../services/notificationService";
import { offlineService } from "../services/offlineService";
import RecordFightForm from "../components/RecordFightForm";
import { FightConfirmationCard } from "../components/FightConfirmationCard";
import { AddPlayersDialog } from "../components/AddPlayersDialog";
import { RemovePlayersDialog } from "../components/RemovePlayersDialog";
import { ChangeCaptainDialog } from "../components/ChangeCaptainDialog";
import { canManageRoster } from "../utils/matchPermissions";

const STAR_COLORS: Record<string, string> = {
  GREEN: "#4CAF50",
  GOLDEN: "#FFD700",
  RAINBOW: "#9C27B0",
};

export default function LiveMatchView() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [fights, setFights] = useState<Fight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const [recordDrawerOpen, setRecordDrawerOpen] = useState(false);
  const [confirmingParticipation, setConfirmingParticipation] = useState(false);
  const [startingMatch, setStartingMatch] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [finishingMatch, setFinishingMatch] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Roster management state
  const [canManageRosterState, setCanManageRosterState] = useState(false);
  const [rosterMenuAnchor, setRosterMenuAnchor] = useState<{
    element: HTMLElement;
    teamId: string;
  } | null>(null);
  const [addPlayersDialogOpen, setAddPlayersDialogOpen] = useState(false);
  const [removePlayersDialogOpen, setRemovePlayersDialogOpen] = useState(false);
  const [changeCaptainDialogOpen, setChangeCaptainDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [clubPlayers, setClubPlayers] = useState<{ [key: string]: Player[] }>(
    {},
  );

  const streakScrollRef = useRef<HTMLDivElement>(null);

  // Pre-start validation
  const canStartMatchValidation = () => {
    if (!match || !user)
      return { allowed: false, reason: "Match or user data not available" };

    // User must have permission to start (checked by canStartMatch earlier)
    // This validation focuses on match state requirements, not authorization

    // Check match status
    if (
      !["pending_participants", "ready_to_start", "ready"].includes(
        match.status,
      )
    ) {
      return {
        allowed: false,
        reason: `Match cannot be started (current status: ${match.status})`,
      };
    }

    // Count confirmed players per team
    const team1Confirmed =
      match.team1?.players?.filter(
        (p: any) => p.confirmationStatus === "confirmed",
      ).length || 0;

    const team2Confirmed =
      match.team2?.players?.filter(
        (p: any) => p.confirmationStatus === "confirmed",
      ).length || 0;

    if (team1Confirmed < 2) {
      return {
        allowed: false,
        reason: `${match.team1?.teamName || "Team 1"} needs at least 2 confirmed players (currently: ${team1Confirmed})`,
      };
    }

    if (team2Confirmed < 2) {
      return {
        allowed: false,
        reason: `${match.team2?.teamName || "Team 2"} needs at least 2 confirmed players (currently: ${team2Confirmed})`,
      };
    }

    // Check if match date is in the future (optional warning)
    const matchDate = new Date(match.scheduledAt || match.matchDate || "");
    const now = new Date();
    if (matchDate > now) {
      const timeUntilMatch = Math.ceil(
        (matchDate.getTime() - now.getTime()) / (1000 * 60),
      ); // minutes
      return {
        allowed: true,
        warning: `Match is scheduled to start in ${timeUntilMatch} minutes. Start now?`,
      };
    }

    return { allowed: true };
  };

  // Check if current user is a captain
  const isCaptain =
    match &&
    ((typeof match.team1?.captain?.playerId === "object"
      ? (match.team1?.captain?.playerId as any)?._id ||
        (match.team1?.captain?.playerId as any)?.id
      : match.team1?.captain?.playerId) === (user?._id || user?.id) ||
      (typeof match.team2?.captain?.playerId === "object"
        ? (match.team2?.captain?.playerId as any)?._id ||
          (match.team2?.captain?.playerId as any)?.id
        : match.team2?.captain?.playerId) === (user?._id || user?.id));

  // Check if user can start the match (organizer, admin, captain, or club owner)
  const canStartMatch =
    match &&
    // User is the organizer
    ((typeof match.organizerId === "string"
      ? match.organizerId === (user?._id || user?.id)
      : (match.organizerId as any)?._id === (user?._id || user?.id) ||
        (match.organizerId as any)?.id === (user?._id || user?.id)) ||
      // User is a captain
      isCaptain ||
      // User is admin
      user?.role === "admin" ||
      // User is owner/co-owner of involved clubs
      (Array.isArray(user?.clubs) &&
        user.clubs.some((userClub: any) => {
          // Get role from populated clubs structure
          const membership =
            typeof userClub === "object" && "role" in userClub
              ? userClub
              : null;
          if (!membership || !membership.club) return false;

          const clubId = membership.club?._id || membership.club?.id;
          const role = membership.role;
          const isOwnerOrCoOwner = role === "owner" || role === "co_owner";

          // Check if this club is involved in the match
          const isInvolvedClub =
            match.involvedClubs?.some(
              (involvedClubId: string) => involvedClubId === clubId,
            ) || false;

          return isOwnerOrCoOwner && isInvolvedClub;
        })));

  // Load match data
  useEffect(() => {
    // Don't try to load if matchId is not a valid ObjectID (e.g., "create")
    if (!matchId || matchId === "create" || matchId.length !== 24) {
      return;
    }

    const loadMatch = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to load from cache first (don't fail if cache fails)
        try {
          const cached = await offlineService.getCachedMatch(matchId);
          if (cached) {
            setMatch(cached);
          }
        } catch (cacheError) {
          console.warn("Cache read failed (non-critical):", cacheError);
        }

        // Then fetch from API
        const fetchedMatch = await getMatchById(matchId);
        console.log("📊 Fetched match data:", fetchedMatch);
        console.log("📊 Match teams:", fetchedMatch?.teams);
        console.log(
          "📋 Team 1:",
          fetchedMatch.teams?.[0] || fetchedMatch.team1,
        );
        console.log(
          "📋 Team 2:",
          fetchedMatch.teams?.[1] || fetchedMatch.team2,
        );
        console.log("📋 Team 1 captain:", fetchedMatch.teams?.[0]?.captain);
        console.log("📋 Team 2 captain:", fetchedMatch.teams?.[1]?.captain);
        console.log("📋 Current user ID:", user?._id || user?.id);

        // Normalize the match data to support both old and new API structure
        const normalizedMatch = {
          ...fetchedMatch,
          team1: fetchedMatch.teams?.[0] || fetchedMatch.team1,
          team2: fetchedMatch.teams?.[1] || fetchedMatch.team2,
        };

        console.log("📊 Normalized team1:", normalizedMatch.team1);
        console.log("📊 Normalized team2:", normalizedMatch.team2);
        setMatch(normalizedMatch);

        // Cache it (don't fail if cache fails)
        try {
          await offlineService.cacheMatch(normalizedMatch);
        } catch (cacheError) {
          console.warn("Cache write failed (non-critical):", cacheError);
        }

        // Load fights
        const fightsResponse = await getFights({ matchId: matchId });
        console.log("📊 Fights data:", fightsResponse);
        console.log(
          "📊 Fights response structure:",
          JSON.stringify(fightsResponse, null, 2),
        );
        console.log("📊 Fights array:", fightsResponse.data);
        console.log("📊 Number of fights:", fightsResponse.data?.length);
        console.log(
          "📊 Fights statuses:",
          fightsResponse.data?.map((f: any) => ({
            id: f._id,
            status: f.status,
          })),
        );

        // Check if data is nested
        if (fightsResponse && Array.isArray(fightsResponse)) {
          console.log(
            "⚠️ Fights response is an array directly, not wrapped in data object",
          );
          setFights(fightsResponse);
        } else if (fightsResponse?.data) {
          console.log("✅ Fights response has data property");
          setFights(fightsResponse.data);
        } else {
          console.error(
            "❌ Unexpected fights response format:",
            fightsResponse,
          );
          setFights([]);
        }
      } catch (err: any) {
        console.error("Failed to load match:", err);
        setError(err.response?.data?.message || "Failed to load match");
        notificationService.error("Failed to load match");
      } finally {
        setLoading(false);
      }
    };

    loadMatch();
  }, [matchId]);

  // Socket.io real-time updates
  useEffect(() => {
    // Don't connect WebSocket for invalid matchIds like "create"
    if (!matchId || matchId === "create" || matchId.length !== 24) {
      return;
    }

    socketService.connect();
    socketService.joinMatchRoom(matchId);

    // Connection status
    const handleConnect = () => {
      setConnected(true);
      setShowConnectionStatus(true);
    };

    const handleDisconnect = () => {
      setConnected(false);
      setShowConnectionStatus(true);
    };

    socketService.on("connect", handleConnect);
    socketService.on("disconnect", handleDisconnect);

    // Match events (using new native WebSocket event names)
    const unsubMatchStarting = socketService.onMatchStarted((message: any) => {
      if (message.matchId === matchId) {
        // Update match data with normalized structure
        const updatedMatch = message.data?.match || message.match;
        if (updatedMatch) {
          const normalizedMatch = {
            ...updatedMatch,
            team1: updatedMatch.teams?.[0] || updatedMatch.team1,
            team2: updatedMatch.teams?.[1] || updatedMatch.team2,
          };
          setMatch(normalizedMatch);
        } else {
          // Fallback: just update status
          setMatch((prev) =>
            prev ? { ...prev, status: MatchStatus.ACTIVE } : null,
          );
        }
        notificationService.success("🎯 Match has started!");
      }
    });

    const unsubFightReported = socketService.onFightReported((message: any) => {
      if (message.matchId === matchId && message.data?.fight) {
        setFights((prev) => [...(prev || []), message.data.fight]);
        const winner = message.data.fight.proposedResult;
        notificationService.info(`Fight reported: ${winner}`);
      }
    });

    const unsubFightConfirmed = socketService.onFightConfirmed(
      (message: any) => {
        if (message.matchId === matchId && message.data?.fight) {
          console.log("🎯 Fight confirmed via WebSocket:", message.data.fight);
          console.log("🎯 Fight status:", message.data.fight.status);
          console.log("🎯 Fight result:", message.data.fight.result);

          // Replace the entire fight object with the updated one from server
          setFights((prev) => {
            const updated = (prev || []).map((f) =>
              (f._id || f.id) ===
              (message.data.fight._id || message.data.fight.id)
                ? message.data.fight
                : f,
            );
            console.log("🎯 Updated fights list:", updated);
            return updated;
          });
          notificationService.success("✅ Fight confirmed by both captains!");

          // Auto-scroll to latest fight
          setTimeout(() => {
            if (streakScrollRef.current) {
              streakScrollRef.current.scrollLeft =
                streakScrollRef.current.scrollWidth;
            }
          }, 100);
        }
      },
    );

    const unsubFightDisputed = socketService.onFightDisputed((message: any) => {
      if (message.matchId === matchId && message.data?.fight) {
        // Update fight with disputed status
        setFights((prev) =>
          (prev || []).map((f) =>
            (f._id || f.id) ===
            (message.data.fight._id || message.data.fight.id)
              ? message.data.fight
              : f,
          ),
        );
        notificationService.warning(
          "⚠️ Fight result disputed - requires admin review",
        );
      }
    });

    const unsubMatchCompleted = socketService.onMatchCompleted(
      (message: any) => {
        if (message.matchId === matchId && message.data?.match) {
          setMatch((prev) =>
            prev
              ? {
                  ...prev,
                  status: MatchStatus.COMPLETED,
                  winnerTeam: message.data.match.winnerTeam,
                }
              : null,
          );
          notificationService.success(
            `Match completed! Winner: Team ${message.data.match.winnerTeam}`,
          );
        }
      },
    );

    // Roster management events
    const unsubPlayersAdded = socketService.onPlayersAdded((message: any) => {
      if (message.matchId === matchId || message.data?.matchId === matchId) {
        console.log("🎯 Players added via WebSocket:", message);
        notificationService.info("Roster updated: Players added");
        // Refresh match data
        if (matchId) {
          getMatchById(matchId).then((refreshedMatch) => {
            const normalizedMatch = {
              ...refreshedMatch,
              team1: refreshedMatch.teams?.[0] || refreshedMatch.team1,
              team2: refreshedMatch.teams?.[1] || refreshedMatch.team2,
            };
            setMatch(normalizedMatch);
          });
        }
      }
    });

    const unsubPlayersRemoved = socketService.onPlayersRemoved(
      (message: any) => {
        if (message.matchId === matchId || message.data?.matchId === matchId) {
          console.log("🎯 Players removed via WebSocket:", message);
          notificationService.info("Roster updated: Players removed");
          // Refresh match data
          if (matchId) {
            getMatchById(matchId).then((refreshedMatch) => {
              const normalizedMatch = {
                ...refreshedMatch,
                team1: refreshedMatch.teams?.[0] || refreshedMatch.team1,
                team2: refreshedMatch.teams?.[1] || refreshedMatch.team2,
              };
              setMatch(normalizedMatch);
            });
          }
        }
      },
    );

    const unsubCaptainChanged = socketService.onCaptainChanged(
      (message: any) => {
        if (message.matchId === matchId || message.data?.matchId === matchId) {
          console.log("🎯 Captain changed via WebSocket:", message);
          notificationService.info("Roster updated: Captain changed");
          // Refresh match data
          if (matchId) {
            getMatchById(matchId).then((refreshedMatch) => {
              const normalizedMatch = {
                ...refreshedMatch,
                team1: refreshedMatch.teams?.[0] || refreshedMatch.team1,
                team2: refreshedMatch.teams?.[1] || refreshedMatch.team2,
              };
              setMatch(normalizedMatch);
            });
          }
        }
      },
    );

    return () => {
      socketService.off("connect", handleConnect);
      socketService.off("disconnect", handleDisconnect);
      unsubMatchStarting();
      unsubFightReported();
      unsubFightConfirmed();
      unsubFightDisputed();
      unsubMatchCompleted();
      unsubPlayersAdded();
      unsubPlayersRemoved();
      unsubCaptainChanged();
      socketService.leaveMatchRoom(matchId);
    };
  }, [matchId]);

  // Auto-hide connection status
  useEffect(() => {
    if (showConnectionStatus) {
      const timer = setTimeout(() => setShowConnectionStatus(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showConnectionStatus]);

  // Check roster management permissions and fetch club players
  useEffect(() => {
    const checkPermissions = async () => {
      if (!match || !user) {
        setCanManageRosterState(false);
        return;
      }

      const canManage = await canManageRoster(user, match);
      setCanManageRosterState(canManage);

      // Fetch players from involved clubs for roster management
      if (canManage && match.teams) {
        const clubPlayersMap: { [key: string]: Player[] } = {};

        for (const team of match.teams) {
          const clubId =
            typeof team.clubId === "string"
              ? team.clubId
              : (team.clubId as Club)?._id || (team.clubId as Club)?.id;

          if (clubId && !clubPlayersMap[clubId]) {
            try {
              const clubData = await getClubById(clubId, true); // populate players
              clubPlayersMap[clubId] = clubData.players as Player[];
            } catch (error) {
              console.error("Failed to fetch club players:", error);
            }
          }
        }

        setClubPlayers(clubPlayersMap);
      }
    };

    checkPermissions();
  }, [match, user]);

  const isSpectator =
    !match ||
    (!match.team1?.players?.some((p: any) => {
      const playerId =
        p.playerId?._id || p.playerId?.id || p.playerId || p._id || p.id;
      return playerId === (user?._id || user?.id);
    }) &&
      !match.team2?.players?.some((p: any) => {
        const playerId =
          p.playerId?._id || p.playerId?.id || p.playerId || p._id || p.id;
        return playerId === (user?._id || user?.id);
      }));

  // Check if current user is captain and needs to confirm
  const needsConfirmation =
    match &&
    isCaptain &&
    match.status === MatchStatus.PENDING_CAPTAIN_CONFIRMATION &&
    ((match.team1?.captain?.confirmationStatus === "pending" &&
      (typeof match.team1?.captain?.playerId === "object"
        ? (match.team1?.captain?.playerId as any)?._id ||
          (match.team1?.captain?.playerId as any)?.id
        : match.team1?.captain?.playerId) === (user?._id || user?.id)) ||
      (match.team2?.captain?.confirmationStatus === "pending" &&
        (typeof match.team2?.captain?.playerId === "object"
          ? (match.team2?.captain?.playerId as any)?._id ||
            (match.team2?.captain?.playerId as any)?.id
          : match.team2?.captain?.playerId) === (user?._id || user?.id)));

  // Check if current user is a player and needs to confirm participation
  const needsPlayerConfirmation =
    match &&
    !isCaptain &&
    match.status === MatchStatus.PENDING_PARTICIPANTS &&
    (match.team1?.players?.some((p: any) => {
      const playerId =
        p.playerId?._id || p.playerId?.id || p.playerId || p._id || p.id;
      return (
        playerId === (user?._id || user?.id) &&
        p.confirmationStatus === "pending"
      );
    }) ||
      match.team2?.players?.some((p: any) => {
        const playerId =
          p.playerId?._id || p.playerId?.id || p.playerId || p._id || p.id;
        return (
          playerId === (user?._id || user?.id) &&
          p.confirmationStatus === "pending"
        );
      }));

  // Debug logging
  console.log("🔍 Confirmation Check:", {
    match: !!match,
    isCaptain,
    matchStatus: match?.status,
    expectedCaptainStatus: MatchStatus.PENDING_CAPTAIN_CONFIRMATION,
    expectedPlayerStatus: MatchStatus.PENDING_PARTICIPANTS,
    userId: user?._id || user?.id,
    team1Captain:
      typeof match?.team1?.captain?.playerId === "object"
        ? match?.team1?.captain?.playerId
        : { _id: match?.team1?.captain?.playerId },
    team1CaptainStatus: match?.team1?.captain?.confirmationStatus,
    team2Captain:
      typeof match?.team2?.captain?.playerId === "object"
        ? match?.team2?.captain?.playerId
        : { _id: match?.team2?.captain?.playerId },
    team2CaptainStatus: match?.team2?.captain?.confirmationStatus,
    needsConfirmation,
    needsPlayerConfirmation,
    team1Players: match?.team1?.players?.map((p: any) => ({
      id: p.playerId?._id || p.playerId?.id || p.playerId || p._id || p.id,
      name: p.playerName,
      confirmationStatus: p.confirmationStatus,
    })),
    team2Players: match?.team2?.players?.map((p: any) => ({
      id: p.playerId?._id || p.playerId?.id || p.playerId || p._id || p.id,
      name: p.playerName,
      confirmationStatus: p.confirmationStatus,
    })),
  });

  const handleConfirmParticipation = async () => {
    if (!matchId || !user) return;

    const playerId = user._id || user.id;
    if (!playerId) return;

    try {
      setConfirmingParticipation(true);
      await confirmParticipation(matchId, playerId);

      // Reload match data
      const updatedMatch = await getMatchById(matchId);
      const normalizedMatch = {
        ...updatedMatch,
        team1: updatedMatch.teams?.[0] || updatedMatch.team1,
        team2: updatedMatch.teams?.[1] || updatedMatch.team2,
      };
      setMatch(normalizedMatch);

      notificationService.success("Participation confirmed successfully!");
    } catch (err: any) {
      console.error("Failed to confirm participation:", err);
      notificationService.error(
        err.response?.data?.message || "Failed to confirm participation",
      );
    } finally {
      setConfirmingParticipation(false);
    }
  };

  const handleDeclineParticipation = async () => {
    if (!matchId || !user) return;

    const playerId = user._id || user.id;
    if (!playerId) return;

    // Ask for optional reason
    const reason = window.prompt("Optional: Provide a reason for declining");

    try {
      setConfirmingParticipation(true);
      const response = await declineParticipation(
        matchId,
        playerId,
        reason || undefined,
      );

      // Normalize and update match data
      const normalizedMatch = {
        ...response,
        team1: response.teams?.[0] || response.team1,
        team2: response.teams?.[1] || response.team2,
      };
      setMatch(normalizedMatch);

      // Show feedback based on result
      if (response.status === "cancelled") {
        notificationService.warning(
          "Match has been cancelled as no replacement captain was available",
        );
      } else {
        notificationService.info(
          "You have declined. A new captain has been assigned.",
        );
      }
    } catch (err: any) {
      console.error("Failed to decline participation:", err);
      notificationService.error(
        err.response?.data?.message || "Failed to decline participation",
      );
    } finally {
      setConfirmingParticipation(false);
    }
  };

  const handleStartMatch = async () => {
    if (!matchId || !user) return;

    // Run pre-start validation
    const validation = canStartMatchValidation();
    if (!validation.allowed) {
      notificationService.error(validation.reason || "Cannot start match");
      return;
    }

    // Show confirmation if there's a warning or if not already shown
    if (validation.warning && !showStartConfirm) {
      setShowStartConfirm(true);
      return;
    }

    try {
      setStartingMatch(true);
      const userId = user._id || user.id;
      if (!userId) {
        throw new Error("User ID not available");
      }

      const startedMatch = await startMatch(matchId, userId);

      // Normalize and update match data
      const normalizedMatch = {
        ...startedMatch,
        team1: startedMatch.teams?.[0] || startedMatch.team1,
        team2: startedMatch.teams?.[1] || startedMatch.team2,
      };
      setMatch(normalizedMatch);

      notificationService.success("🎯 Match started! Good luck!");
    } catch (err: any) {
      console.error("Failed to start match:", err);

      // Handle specific error cases
      const errorMessage = err.response?.data?.message || "";
      if (errorMessage.includes("organizer")) {
        notificationService.error(
          "Only the match organizer can start this match",
        );
      } else if (errorMessage.includes("participants")) {
        notificationService.error(
          "Both teams need at least 2 confirmed players",
        );
      } else if (errorMessage.includes("not found")) {
        notificationService.error(
          "Match not found or is no longer available to start",
        );
      } else {
        notificationService.error(errorMessage || "Failed to start match");
      }
    } finally {
      setStartingMatch(false);
      setShowStartConfirm(false);
    }
  };

  const handleFinishMatch = async () => {
    if (!match || !user) return;

    // Verify user is a captain
    if (!isCaptain) {
      notificationService.error(
        "Only team captains can declare the match winner",
      );
      setShowFinishConfirm(false);
      return;
    }

    try {
      setFinishingMatch(true);

      // Get current user's team
      const currentUserId = user._id || user.id;
      const myCaptainTeam = match.teams?.find((team) => {
        const captainId =
          typeof team.captain?.playerId === "object"
            ? (team.captain.playerId as any)?._id ||
              (team.captain.playerId as any)?.id
            : team.captain?.playerId;
        return captainId === currentUserId;
      });

      if (!myCaptainTeam) {
        notificationService.error("Could not identify your team");
        return;
      }

      // Determine winner based on current score
      const team1Score = confirmedFights.filter((f) => {
        const fightResult = f.result || f.proposedResult;
        return fightResult === "player1";
      }).length;

      const team2Score = confirmedFights.filter((f) => {
        const fightResult = f.result || f.proposedResult;
        return fightResult === "player2";
      }).length;

      let winningTeamId: string;
      if (team1Score > team2Score) {
        winningTeamId = match.teams?.[0]?.teamId || "team1";
      } else if (team2Score > team1Score) {
        winningTeamId = match.teams?.[1]?.teamId || "team2";
      } else {
        // For draw, let captain choose
        notificationService.warning(
          "Match is tied. Please select the winning team manually.",
        );
        setShowFinishConfirm(false);
        setFinishingMatch(false);
        return;
      }

      // Get current confirmation round
      const currentRound = match.matchResult?.declarations?.length >= 2 ? 2 : 1;

      const updatedMatch = await declareWinner({
        matchId: match._id || match.id,
        captainId: currentUserId,
        winningTeamId: winningTeamId,
        confirmationRound: currentRound,
      });

      setMatch(updatedMatch);

      // Check match status
      if (updatedMatch.status === "completed") {
        notificationService.success(
          "🎉 Match completed! Both captains agreed on the winner.",
        );
      } else if (updatedMatch.matchResult?.status === "disputed") {
        notificationService.warning(
          currentRound === 1
            ? "⚠️ Captains disagreed. Please confirm again in Round 2."
            : "⚠️ Still disagreed. Match sent for admin review.",
        );
      } else {
        notificationService.info(
          "✅ Your declaration recorded. Waiting for other captain.",
        );
      }

      // Refresh match data
      if (matchId) {
        const refreshedMatch = await getMatchById(matchId);
        setMatch(refreshedMatch);
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to declare winner";
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setFinishingMatch(false);
      setShowFinishConfirm(false);
    }
  };

  // Roster management handlers
  const handleOpenRosterMenu = (
    event: React.MouseEvent<HTMLElement>,
    teamId: string,
  ) => {
    setRosterMenuAnchor({ element: event.currentTarget, teamId });
  };

  const handleCloseRosterMenu = () => {
    setRosterMenuAnchor(null);
  };

  const handleAddPlayers = (teamId: string) => {
    setSelectedTeamId(teamId);
    setAddPlayersDialogOpen(true);
    handleCloseRosterMenu();
  };

  const handleRemovePlayers = (teamId: string) => {
    setSelectedTeamId(teamId);
    setRemovePlayersDialogOpen(true);
    handleCloseRosterMenu();
  };

  const handleChangeCaptain = (teamId: string) => {
    setSelectedTeamId(teamId);
    setChangeCaptainDialogOpen(true);
    handleCloseRosterMenu();
  };

  const handleRosterSuccess = async () => {
    // Refresh match data
    if (matchId) {
      try {
        const refreshedMatch = await getMatchById(matchId);
        const normalizedMatch = {
          ...refreshedMatch,
          team1: refreshedMatch.teams?.[0] || refreshedMatch.team1,
          team2: refreshedMatch.teams?.[1] || refreshedMatch.team2,
        };
        setMatch(normalizedMatch);
      } catch (error) {
        console.error("Failed to refresh match:", error);
      }
    }
  };

  const getClubPlayersForTeam = (teamId: string): Player[] => {
    if (!match) return [];

    // Handle both old and new API structure
    const teams = match.teams || [match.team1, match.team2].filter(Boolean);
    if (!teams || teams.length === 0) return [];

    const team = teams.find((t) => t?.teamId === teamId);
    if (!team) return [];

    const clubId =
      typeof team.clubId === "string"
        ? team.clubId
        : (team.clubId as Club)?._id || (team.clubId as Club)?.id;

    return clubPlayers[clubId] || [];
  };

  const confirmedFights =
    fights?.filter((f) => f.status === FightStatus.CONFIRMED) || [];

  console.log("📊 Score Calculation Debug:");
  console.log("📊 Total fights:", fights?.length || 0);
  console.log("📊 Confirmed fights:", confirmedFights.length);
  console.log(
    "📊 All fights details:",
    fights?.map((f) => ({
      id: f._id || f.id,
      status: f.status,
      result: f.result,
      captainConfirmations: f.captainConfirmations?.length,
      confirmationDetails: f.captainConfirmations?.map((c) => ({
        captainId: c.captainId,
        agreedResult: c.agreedResult,
        order: c.confirmationOrder,
      })),
    })),
  );
  console.log("📊 Fights by status:", {
    confirmed: fights?.filter((f) => f.status === "confirmed").length,
    pending: fights?.filter((f) => f.status === "pending_captain_confirmation")
      .length,
    disputed: fights?.filter((f) => f.status === "disputed").length,
  });

  // Calculate scores based on fight result (player1, player2, or draw)
  // player1 represents team1 player, player2 represents team2 player
  const team1Score = confirmedFights.filter((f) => {
    // Check both result and proposedResult fields (backend uses proposedResult)
    const fightResult = f.result || f.proposedResult;

    // If result is 'player1', team1 won
    if (fightResult === "player1") return true;

    // Also check for winner field for backwards compatibility
    const winnerId = f.winner?._id || f.winner?.id;
    if (!winnerId) return false;

    // Check if winner is from team1
    return match?.team1?.players?.some((p: any) => {
      const playerId =
        p.playerId?._id || p.playerId?.id || p.playerId || p._id || p.id;
      return playerId === winnerId;
    });
  }).length;

  const team2Score = confirmedFights.filter((f) => {
    // Check both result and proposedResult fields (backend uses proposedResult)
    const fightResult = f.result || f.proposedResult;

    // If result is 'player2', team2 won
    if (fightResult === "player2") return true;

    // Also check for winner field for backwards compatibility
    const winnerId = f.winner?._id || f.winner?.id;
    if (!winnerId) return false;

    // Check if winner is from team2
    return match?.team2?.players?.some((p: any) => {
      const playerId =
        p.playerId?._id || p.playerId?.id || p.playerId || p._id || p.id;
      return playerId === winnerId;
    });
  }).length;

  console.log("📊 Team 1 Score:", team1Score);
  console.log("📊 Team 2 Score:", team2Score);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !match) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error || "Match not found"}</Alert>
        <Button onClick={() => navigate("/matches")} sx={{ mt: 2 }}>
          Back to Matches
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      {/* Header */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
          p: 2,
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={() => navigate("/matches")}>
            <BackIcon />
          </IconButton>
          <Box flex={1}>
            <Typography variant="h6">
              {match.team1?.club?.name || match.team1?.teamName || "Team 1"} vs{" "}
              {match.team2?.club?.name || match.team2?.teamName || "Team 2"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {match.scheduledAt || match.matchDate
                ? format(new Date(match.scheduledAt || match.matchDate!), "PPp")
                : "Date not available"}
            </Typography>
          </Box>
          <IconButton size="small">
            {connected ? (
              <ConnectedIcon color="success" />
            ) : (
              <DisconnectedIcon color="error" />
            )}
          </IconButton>
        </Box>

        {/* Status Chips */}
        <Box display="flex" gap={1} mt={1}>
          <Chip
            label={match.status}
            color={
              match.status === MatchStatus.ACTIVE
                ? "success"
                : match.status === MatchStatus.READY_TO_START
                  ? "info"
                  : match.status === MatchStatus.COMPLETED
                    ? "default"
                    : "warning"
            }
            size="small"
          />
          <Chip
            label={match.type || match.matchType}
            variant="outlined"
            size="small"
          />
          {isSpectator && (
            <Chip label="Spectator Mode" color="info" size="small" />
          )}
        </Box>
      </Box>

      {/* Captain Confirmation Card */}
      {needsConfirmation && (
        <Box sx={{ p: 2 }}>
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<ConfirmIcon />}
                  onClick={handleConfirmParticipation}
                  disabled={confirmingParticipation}
                >
                  {confirmingParticipation ? "Processing..." : "Confirm"}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeclineIcon />}
                  onClick={handleDeclineParticipation}
                  disabled={confirmingParticipation}
                >
                  Decline
                </Button>
              </Box>
            }
          >
            <Typography variant="body2" fontWeight="medium">
              Match Confirmation Required
            </Typography>
            <Typography variant="caption">
              You have been selected as a captain for this match. Please confirm
              your participation.
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Player Confirmation Card */}
      {needsPlayerConfirmation && (
        <Box sx={{ p: 2 }}>
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={<ConfirmIcon />}
                onClick={handleConfirmParticipation}
                disabled={confirmingParticipation}
              >
                {confirmingParticipation ? "Processing..." : "Confirm"}
              </Button>
            }
          >
            <Typography variant="body2" fontWeight="medium">
              Player Confirmation Required
            </Typography>
            <Typography variant="caption">
              Please confirm your participation in this match.
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Score */}
      <Box sx={{ p: 2, textAlign: "center", bgcolor: "background.default" }}>
        <Typography
          variant="h3"
          component="div"
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 2,
          }}
        >
          <span>{team1Score}</span>
          <Typography variant="h5" color="text.secondary">
            -
          </Typography>
          <span>{team2Score}</span>
        </Typography>
        <Box
          display="flex"
          gap={1}
          justifyContent="center"
          alignItems="center"
          flexWrap="wrap"
          mt={1}
        >
          <Typography variant="caption" color="text.secondary">
            {confirmedFights.length} confirmed
          </Typography>
          {fights && fights.length > confirmedFights.length && (
            <>
              <Typography variant="caption" color="text.secondary">
                •
              </Typography>
              <Chip
                label={`${fights.length - confirmedFights.length} pending approval`}
                size="small"
                color="warning"
                variant="outlined"
              />
            </>
          )}
        </Box>
      </Box>

      {/* Streak Visualization */}
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Fight History
        </Typography>
        <Box
          ref={streakScrollRef}
          sx={{
            display: "flex",
            gap: 1,
            overflowX: "auto",
            pb: 1,
            "&::-webkit-scrollbar": {
              height: 8,
            },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "divider",
              borderRadius: 1,
            },
          }}
        >
          {confirmedFights.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No fights recorded yet
            </Typography>
          ) : (
            confirmedFights.map((fight, index) => {
              // Get player names for tooltip
              const getPlayerName = (playerObj: any): string => {
                if (!playerObj) return "Unknown";
                const player = playerObj.playerId || playerObj;
                return (
                  player?.name ||
                  player?.playerName ||
                  playerObj.playerName ||
                  "Unknown"
                );
              };

              const team1PlayerName = getPlayerName(
                fight.team1Player || fight.player1,
              );
              const team2PlayerName = getPlayerName(
                fight.team2Player || fight.player2,
              );

              // Determine fight result
              const fightResult = fight.result || fight.proposedResult;
              const isDraw = fightResult === "draw";
              const team1Won = fightResult === "player1";
              const team2Won = fightResult === "player2";

              // Determine if current user is on team1 or team2
              const currentUserId = user?._id || user?.id;
              const isUserOnTeam1 = match.team1?.players?.some((p: any) => {
                const playerId =
                  p.playerId?._id ||
                  p.playerId?.id ||
                  p.playerId ||
                  p._id ||
                  p.id;
                return playerId === currentUserId;
              });
              const isUserOnTeam2 = match.team2?.players?.some((p: any) => {
                const playerId =
                  p.playerId?._id ||
                  p.playerId?.id ||
                  p.playerId ||
                  p._id ||
                  p.id;
                return playerId === currentUserId;
              });

              // Color badge from user's perspective
              let badgeColor = "warning.main"; // Yellow for draw or spectator
              if (isDraw) {
                badgeColor = "warning.main";
              } else if (isUserOnTeam1 && team1Won) {
                badgeColor = "success.main"; // Green - user's team won
              } else if (isUserOnTeam2 && team2Won) {
                badgeColor = "success.main"; // Green - user's team won
              } else if (
                (isUserOnTeam1 && team2Won) ||
                (isUserOnTeam2 && team1Won)
              ) {
                badgeColor = "error.main"; // Red - user's team lost
              }

              // Fight number in chronological order (oldest = 1)
              const fightNumber = confirmedFights.length - index;

              const tooltipTitle = isDraw
                ? `Fight ${fightNumber}: ${team1PlayerName} vs ${team2PlayerName} (Draw)`
                : team1Won
                  ? `Fight ${fightNumber}: ${team1PlayerName} won vs ${team2PlayerName}`
                  : `Fight ${fightNumber}: ${team2PlayerName} won vs ${team1PlayerName}`;

              return (
                <Tooltip key={fight._id || fight.id} title={tooltipTitle} arrow>
                  <Box
                    sx={{
                      minWidth: 40,
                      height: 40,
                      borderRadius: "50%",
                      bgcolor: badgeColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    {fightNumber}
                  </Box>
                </Tooltip>
              );
            })
          )}
        </Box>
      </Box>

      {/* Pending Fight Confirmations - Only show to captains */}
      {(() => {
        console.log("🔍 Checking pending fights section...");
        console.log("🔍 Fights:", fights);
        console.log("🔍 User:", user);
        console.log("🔍 Match teams:", match?.teams);

        const pendingFights =
          fights?.filter((f) => f.status === "pending_captain_confirmation") ||
          [];
        console.log("🔍 Pending fights:", pendingFights);
        console.log("🔍 Pending fights count:", pendingFights.length);

        const currentUserId = user?._id || user?.id;
        console.log("🔍 Current user ID:", currentUserId);
        console.log("🔍 Is captain (from existing check)?", isCaptain);

        if (!isCaptain) {
          console.log("❌ Not showing: User is not a captain");
          return null;
        }

        if (pendingFights.length === 0) {
          console.log("❌ Not showing: No pending fights");
          return null;
        }

        console.log("✅ Showing pending fights section!");

        // Calculate stats (currentUserId already declared above)
        const myPendingCount = pendingFights.filter(
          (f) =>
            !f.captainConfirmations?.some((c) => c.captainId === currentUserId),
        ).length;
        const waitingForOtherCount = pendingFights.filter((f) =>
          f.captainConfirmations?.some((c) => c.captainId === currentUserId),
        ).length;

        return (
          <Box sx={{ px: 2, py: 2, bgcolor: "background.default" }}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              mb={1}
            >
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                color="warning.main"
              >
                ⏳ Pending Fight Confirmations
              </Typography>
              <Box display="flex" gap={1}>
                {myPendingCount > 0 && (
                  <Chip
                    label={`${myPendingCount} need your approval`}
                    color="warning"
                    size="small"
                  />
                )}
                {waitingForOtherCount > 0 && (
                  <Chip
                    label={`${waitingForOtherCount} waiting for other captain`}
                    color="info"
                    size="small"
                  />
                )}
              </Box>
            </Box>
            {pendingFights.map((fight) => (
              <FightConfirmationCard
                key={fight._id || fight.id}
                fight={fight}
                currentUserId={currentUserId || ""}
                match={match}
                onConfirmed={(updatedFight) => {
                  // Update the fight in the list
                  setFights((prev) =>
                    (prev || []).map((f) =>
                      (f._id || f.id) === (updatedFight._id || updatedFight.id)
                        ? updatedFight
                        : f,
                    ),
                  );
                  // Refresh fights from API to get latest state
                  if (matchId) {
                    getFights({ matchId }).then((response) => {
                      setFights(response.data);
                    });
                  }
                }}
              />
            ))}
          </Box>
        );
      })()}

      {/* Pending Match Result Declaration - Only show to captains */}
      {(() => {
        const currentUserId = user?._id || user?.id;

        // Check if user is a captain
        const myCaptainTeam = match?.teams?.find((team) => {
          const captainId =
            typeof team.captain?.playerId === "object"
              ? (team.captain.playerId as any)?._id ||
                (team.captain.playerId as any)?.id
              : team.captain?.playerId;
          return captainId === currentUserId;
        });

        if (!myCaptainTeam || match.status !== MatchStatus.ACTIVE) {
          return null;
        }

        // Get current confirmation round
        const currentRound =
          match.matchResult?.declarations?.length >= 2 ? 2 : 1;

        // Check if current user already declared in this round
        const myDeclaration = match.matchResult?.declarations?.find(
          (d) =>
            d.captainId === currentUserId &&
            d.confirmationRound === currentRound,
        );

        // Get other captain's declaration in current round
        const otherDeclaration = match.matchResult?.declarations?.find(
          (d) =>
            d.captainId !== currentUserId &&
            d.confirmationRound === currentRound,
        );

        // Only show if other captain declared but current user hasn't
        if (!otherDeclaration || myDeclaration) {
          return null;
        }

        // Get team names
        const getTeamName = (teamId: string) => {
          const team = match.teams?.find((t) => t.teamId === teamId);
          return team?.teamName || teamId;
        };

        const declaredWinnerName = getTeamName(otherDeclaration.declaredWinner);

        return (
          <Box
            sx={{
              px: 2,
              py: 2,
              bgcolor: "warning.50",
              borderLeft: "4px solid",
              borderColor: "warning.main",
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <TrophyIcon color="warning" />
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                color="warning.dark"
              >
                🏆 Match Result Declaration{" "}
                {currentRound > 1 && `(Round ${currentRound})`}
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium">
                Other captain has declared <strong>{declaredWinnerName}</strong>{" "}
                as the winner.
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                mt={0.5}
              >
                Declared at:{" "}
                {new Date(otherDeclaration.declaredAt).toLocaleString()}
              </Typography>
            </Alert>

            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                color="success"
                startIcon={<ConfirmIcon />}
                fullWidth
                onClick={async () => {
                  try {
                    setFinishingMatch(true);
                    const updatedMatch = await declareWinner({
                      matchId: match._id || match.id,
                      captainId: currentUserId,
                      winningTeamId: otherDeclaration.declaredWinner,
                      confirmationRound: currentRound,
                    });
                    setMatch(updatedMatch);

                    if (updatedMatch.status === "completed") {
                      notificationService.success(
                        "🎉 Match completed! Both captains agreed on the winner.",
                      );
                    } else {
                      notificationService.info("✅ Your approval recorded.");
                    }

                    // Refresh match
                    if (matchId) {
                      const refreshedMatch = await getMatchById(matchId);
                      setMatch(refreshedMatch);
                    }
                  } catch (err: any) {
                    notificationService.error(
                      err.response?.data?.message || "Failed to approve",
                    );
                  } finally {
                    setFinishingMatch(false);
                  }
                }}
                disabled={finishingMatch}
              >
                {finishingMatch ? "Approving..." : "Agree"}
              </Button>

              <Button
                variant="contained"
                color="error"
                startIcon={<DeclineIcon />}
                fullWidth
                onClick={async () => {
                  try {
                    setFinishingMatch(true);

                    // Determine winner based on current score for disagreement
                    const team1Score = confirmedFights.filter((f) => {
                      const fightResult = f.result || f.proposedResult;
                      return fightResult === "player1";
                    }).length;

                    const team2Score = confirmedFights.filter((f) => {
                      const fightResult = f.result || f.proposedResult;
                      return fightResult === "player2";
                    }).length;

                    let myWinningTeamId: string;
                    if (team1Score > team2Score) {
                      myWinningTeamId = match.teams?.[0]?.teamId || "team1";
                    } else if (team2Score > team1Score) {
                      myWinningTeamId = match.teams?.[1]?.teamId || "team2";
                    } else {
                      // Different from what other captain declared
                      myWinningTeamId =
                        match.teams?.find(
                          (t) => t.teamId !== otherDeclaration.declaredWinner,
                        )?.teamId || "team2";
                    }

                    const updatedMatch = await declareWinner({
                      matchId: match._id || match.id,
                      captainId: currentUserId,
                      winningTeamId: myWinningTeamId,
                      confirmationRound: currentRound,
                    });
                    setMatch(updatedMatch);

                    notificationService.warning(
                      currentRound === 1
                        ? "⚠️ Disagreement recorded. Moving to Round 2..."
                        : "⚠️ Still disagreed. Match sent for admin review.",
                    );

                    // Refresh match
                    if (matchId) {
                      const refreshedMatch = await getMatchById(matchId);
                      setMatch(refreshedMatch);
                    }
                  } catch (err: any) {
                    notificationService.error(
                      err.response?.data?.message || "Failed to disagree",
                    );
                  } finally {
                    setFinishingMatch(false);
                  }
                }}
                disabled={finishingMatch}
              >
                {finishingMatch ? "Processing..." : "Disagree"}
              </Button>
            </Box>
          </Box>
        );
      })()}

      <Divider />

      {/* Team 1 */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Box>
            <Typography variant="h6">
              {match.team1?.club?.name ||
                (typeof match.team1?.clubId === "object"
                  ? (match.team1.clubId as any)?.name
                  : "") ||
                match.team1?.teamName ||
                "Team 1"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Captain:{" "}
              {(typeof match.team1?.captain?.playerId === "object"
                ? (match.team1.captain.playerId as any)?.name
                : "") || "Not assigned"}
            </Typography>
          </Box>
          {canManageRosterState && navigator.onLine && (
            <IconButton
              onClick={(e) =>
                handleOpenRosterMenu(e, match.teams?.[0]?.teamId || "team1")
              }
              size="small"
              title="Manage Roster"
            >
              <ManageAccountsIcon />
            </IconButton>
          )}
        </Box>
        {match.team1?.players && match.team1.players.length > 0 ? (
          match.team1.players.map((playerData: any) => {
            const player = playerData.playerId || playerData;
            const playerName =
              player?.name || playerData.playerName || "Unknown";
            const playerId = player?._id || player?.id || playerData._id;
            return (
              <Card key={playerId} sx={{ mb: 1 }}>
                <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: "primary.main" }}>
                      {playerName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body1">{playerName}</Typography>
                        {/* Fight result dots */}
                        <Box display="flex" gap={0.5}>
                          {confirmedFights
                            .filter((fight) => {
                              const player1 =
                                fight.team1Player || fight.player1;
                              const player2 =
                                fight.team2Player || fight.player2;
                              const p1Id =
                                player1?.playerId?._id ||
                                player1?.playerId?.id ||
                                player1?._id ||
                                player1?.id;
                              const p2Id =
                                player2?.playerId?._id ||
                                player2?.playerId?.id ||
                                player2?._id ||
                                player2?.id;
                              return p1Id === playerId || p2Id === playerId;
                            })
                            .map((fight, idx) => {
                              const fightResult =
                                fight.result || fight.proposedResult;
                              const player1 =
                                fight.team1Player || fight.player1;
                              const p1Id =
                                player1?.playerId?._id ||
                                player1?.playerId?.id ||
                                player1?._id ||
                                player1?.id;
                              const playerWon =
                                (fightResult === "player1" &&
                                  p1Id === playerId) ||
                                (fightResult === "player2" &&
                                  p1Id !== playerId);
                              const isDraw = fightResult === "draw";

                              return (
                                <Box
                                  key={idx}
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: "50%",
                                    bgcolor: isDraw
                                      ? "warning.main"
                                      : playerWon
                                        ? "success.main"
                                        : "error.main",
                                  }}
                                />
                              );
                            })}
                        </Box>
                      </Box>
                      {player?.starTrophies &&
                        player.starTrophies.length > 0 && (
                          <Box display="flex" gap={0.5} mt={0.5}>
                            {player.starTrophies
                              .slice(0, 3)
                              .map((trophy: any, idx: number) => (
                                <TrophyIcon
                                  key={idx}
                                  sx={{
                                    fontSize: 16,
                                    color: STAR_COLORS[trophy.starType],
                                  }}
                                />
                              ))}
                            {player.starTrophies.length > 3 && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                +{player.starTrophies.length - 3}
                              </Typography>
                            )}
                          </Box>
                        )}
                    </Box>
                    {player.currentStreak && player.currentStreak.count > 0 && (
                      <Chip
                        label={`${player.currentStreak.count} streak`}
                        size="small"
                        color={
                          player.currentStreak.count >= 3
                            ? "success"
                            : "default"
                        }
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Typography variant="body2" color="text.secondary">
            Player details not available
          </Typography>
        )}
      </Box>

      <Divider />

      {/* Team 2 */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Box>
            <Typography variant="h6">
              {match.team2?.club?.name ||
                (typeof match.team2?.clubId === "object"
                  ? (match.team2.clubId as any)?.name
                  : "") ||
                match.team2?.teamName ||
                "Team 2"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Captain:{" "}
              {(typeof match.team2?.captain?.playerId === "object"
                ? (match.team2.captain.playerId as any)?.name
                : "") || "Not assigned"}
            </Typography>
          </Box>
          {canManageRosterState && navigator.onLine && (
            <IconButton
              onClick={(e) =>
                handleOpenRosterMenu(e, match.teams?.[1]?.teamId || "team2")
              }
              size="small"
              title="Manage Roster"
            >
              <ManageAccountsIcon />
            </IconButton>
          )}
        </Box>
        {match.team2?.players && match.team2.players.length > 0 ? (
          match.team2.players.map((playerData: any) => {
            const player = playerData.playerId || playerData;
            const playerName =
              player?.name || playerData.playerName || "Unknown";
            const playerId = player?._id || player?.id || playerData._id;
            return (
              <Card key={playerId} sx={{ mb: 1 }}>
                <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: "secondary.main" }}>
                      {playerName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body1">{playerName}</Typography>
                        {/* Fight result dots */}
                        <Box display="flex" gap={0.5}>
                          {confirmedFights
                            .filter((fight) => {
                              const player1 =
                                fight.team1Player || fight.player1;
                              const player2 =
                                fight.team2Player || fight.player2;
                              const p1Id =
                                player1?.playerId?._id ||
                                player1?.playerId?.id ||
                                player1?._id ||
                                player1?.id;
                              const p2Id =
                                player2?.playerId?._id ||
                                player2?.playerId?.id ||
                                player2?._id ||
                                player2?.id;
                              return p1Id === playerId || p2Id === playerId;
                            })
                            .map((fight, idx) => {
                              const fightResult =
                                fight.result || fight.proposedResult;
                              const player1 =
                                fight.team1Player || fight.player1;
                              const p1Id =
                                player1?.playerId?._id ||
                                player1?.playerId?.id ||
                                player1?._id ||
                                player1?.id;
                              const playerWon =
                                (fightResult === "player1" &&
                                  p1Id === playerId) ||
                                (fightResult === "player2" &&
                                  p1Id !== playerId);
                              const isDraw = fightResult === "draw";

                              return (
                                <Box
                                  key={idx}
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: "50%",
                                    bgcolor: isDraw
                                      ? "warning.main"
                                      : playerWon
                                        ? "success.main"
                                        : "error.main",
                                  }}
                                />
                              );
                            })}
                        </Box>
                      </Box>
                      {player?.starTrophies &&
                        player.starTrophies.length > 0 && (
                          <Box display="flex" gap={0.5} mt={0.5}>
                            {player.starTrophies
                              .slice(0, 3)
                              .map((trophy: any, idx: number) => (
                                <TrophyIcon
                                  key={idx}
                                  sx={{
                                    fontSize: 16,
                                    color: STAR_COLORS[trophy.starType],
                                  }}
                                />
                              ))}
                            {player.starTrophies.length > 3 && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                +{player.starTrophies.length - 3}
                              </Typography>
                            )}
                          </Box>
                        )}
                    </Box>
                    {player.currentStreak && player.currentStreak.count > 0 && (
                      <Chip
                        label={`${player.currentStreak.count} streak`}
                        size="small"
                        color={
                          player.currentStreak.count >= 3
                            ? "success"
                            : "default"
                        }
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Typography variant="body2" color="text.secondary">
            Player details not available
          </Typography>
        )}
      </Box>

      {/* Start Match Button (for organizer/club owners) */}
      {canStartMatch &&
        (match.status === MatchStatus.READY_TO_START ||
          match.status === "ready_to_start" ||
          match.status === "ready" ||
          match.status === "pending_participants") &&
        (() => {
          const validation = canStartMatchValidation();
          return (
            <Box
              sx={{
                position: "fixed",
                bottom: isMobile ? 72 : 16,
                right: 16,
                left: 16,
                mx: "auto",
                maxWidth: 400,
              }}
            >
              <Button
                variant="contained"
                color="success"
                fullWidth
                size="large"
                onClick={handleStartMatch}
                disabled={startingMatch || !validation.allowed}
                title={
                  validation.allowed
                    ? validation.warning || "Click to start the match"
                    : validation.reason
                }
                sx={{ height: 48 }}
              >
                {startingMatch
                  ? "Starting Match..."
                  : validation.allowed
                    ? "Start Match"
                    : "Cannot Start"}
              </Button>
              {!validation.allowed && validation.reason && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ mt: 1, display: "block", textAlign: "center" }}
                >
                  {validation.reason}
                </Typography>
              )}
            </Box>
          );
        })()}

      {/* Record Fight and Finish Match Buttons (for captains) */}
      {isCaptain && match.status === MatchStatus.ACTIVE && (
        <Box
          sx={{
            position: "fixed",
            bottom: isMobile ? 72 : 16,
            right: 16,
            left: 16,
            mx: "auto",
            maxWidth: 400,
            display: "flex",
            gap: 1,
          }}
        >
          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<AddIcon />}
            onClick={() => setRecordDrawerOpen(true)}
            sx={{ height: 48 }}
          >
            Record Fight
          </Button>
          <Button
            variant="contained"
            color="success"
            fullWidth
            size="large"
            startIcon={<TrophyIcon />}
            onClick={() => setShowFinishConfirm(true)}
            sx={{ height: 48 }}
          >
            Finish
          </Button>
        </Box>
      )}

      {/* Start Match Confirmation Dialog */}
      {showStartConfirm && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1300,
          }}
          onClick={() => setShowStartConfirm(false)}
        >
          <Card
            sx={{ maxWidth: 400, m: 2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Start Match
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {canStartMatchValidation().warning ||
                  "Are you sure you want to start this match?"}
              </Typography>
              <Box display="flex" gap={1} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => setShowStartConfirm(false)}
                  disabled={startingMatch}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleStartMatch}
                  disabled={startingMatch}
                >
                  {startingMatch ? "Starting..." : "Start Match"}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Finish Match Confirmation Dialog */}
      {showFinishConfirm && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1300,
          }}
          onClick={() => setShowFinishConfirm(false)}
        >
          <Card
            sx={{ maxWidth: 400, m: 2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Finish Match
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Are you sure you want to finish this match? The winner will be
                determined based on the current score.
              </Typography>
              <Box display="flex" gap={1} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => setShowFinishConfirm(false)}
                  disabled={finishingMatch}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleFinishMatch}
                  disabled={finishingMatch}
                >
                  {finishingMatch ? "Finishing..." : "Finish Match"}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Finish Match Confirmation Dialog */}
      {showFinishConfirm && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1300,
          }}
          onClick={() => setShowFinishConfirm(false)}
        >
          <Card
            sx={{ maxWidth: 400, m: 2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Finish Match
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Are you sure you want to finish this match? The winner will be
                determined based on the current score.
              </Typography>
              <Box display="flex" gap={1} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => setShowFinishConfirm(false)}
                  disabled={finishingMatch}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleFinishMatch}
                  disabled={finishingMatch}
                >
                  {finishingMatch ? "Finishing..." : "Finish Match"}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Connection Status Snackbar */}
      <Snackbar
        open={showConnectionStatus}
        autoHideDuration={3000}
        onClose={() => setShowConnectionStatus(false)}
        message={
          connected
            ? "Connected to live updates"
            : "Disconnected from live updates"
        }
      />

      {/* Record Fight Drawer */}
      <Drawer
        anchor="bottom"
        open={recordDrawerOpen}
        onClose={() => setRecordDrawerOpen(false)}
      >
        {match && match.team1?.players && match.team2?.players && user && (
          <RecordFightForm
            matchId={match._id || match.id}
            currentUserId={user._id || user.id}
            matchStatus={match.status}
            team1Players={match.team1.players.map((p: any) => p.playerId || p)}
            team2Players={match.team2.players.map((p: any) => p.playerId || p)}
            onSuccess={() => {
              setRecordDrawerOpen(false);
              // Reload fights
              if (matchId) {
                getFights({ matchId }).then((response) => {
                  setFights(response.data);
                });
              }
            }}
            onCancel={() => setRecordDrawerOpen(false)}
          />
        )}
      </Drawer>

      {/* Roster Management Menu */}
      <Menu
        anchorEl={rosterMenuAnchor?.element}
        open={Boolean(rosterMenuAnchor)}
        onClose={handleCloseRosterMenu}
      >
        <MenuItem
          onClick={() =>
            rosterMenuAnchor && handleAddPlayers(rosterMenuAnchor.teamId)
          }
        >
          <ListItemIcon>
            <PersonAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add Players</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() =>
            rosterMenuAnchor && handleRemovePlayers(rosterMenuAnchor.teamId)
          }
        >
          <ListItemIcon>
            <PersonRemoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Remove Players</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() =>
            rosterMenuAnchor && handleChangeCaptain(rosterMenuAnchor.teamId)
          }
        >
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Change Captain</ListItemText>
        </MenuItem>
      </Menu>

      {/* Roster Management Dialogs */}
      {match && (
        <>
          <AddPlayersDialog
            open={addPlayersDialogOpen}
            onClose={() => setAddPlayersDialogOpen(false)}
            match={match}
            teamId={selectedTeamId}
            availablePlayers={getClubPlayersForTeam(selectedTeamId)}
            onSuccess={handleRosterSuccess}
          />
          <RemovePlayersDialog
            open={removePlayersDialogOpen}
            onClose={() => setRemovePlayersDialogOpen(false)}
            match={match}
            teamId={selectedTeamId}
            onSuccess={handleRosterSuccess}
          />
          <ChangeCaptainDialog
            open={changeCaptainDialogOpen}
            onClose={() => setChangeCaptainDialogOpen(false)}
            match={match}
            teamId={selectedTeamId}
            onSuccess={handleRosterSuccess}
          />
        </>
      )}
    </Box>
  );
}
