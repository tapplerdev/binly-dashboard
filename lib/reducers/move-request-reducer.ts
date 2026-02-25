import { BinWithPriority } from '@/lib/types/bin';
import { NearbyPotentialLocation } from '@/lib/api/potential-locations';
import { BinChangeReasonCategory } from '@/lib/types/bin-change-reason';
import { addDays } from 'date-fns';

// ============================================================================
// State Types
// ============================================================================

export type WizardStep = 'selection' | 'configuration';
export type MoveMode = 'field_bins' | 'warehouse_bins';
export type MoveType = 'store' | 'relocation' | 'redeployment';
export type DestinationType = 'custom' | 'potential_location';
export type AssignmentType = 'unassigned' | 'user' | 'active_shift' | 'future_shift';
export type DateOption = '24h' | '3days' | 'week' | 'custom';

export interface BinConfiguration {
  bin: BinWithPriority;
  moveType: MoveType;

  // Destination (for relocation/redeployment)
  destination: {
    type: DestinationType;
    street?: string;
    city?: string;
    zip?: string;
    latitude?: number;
    longitude?: number;
    potentialLocationId?: string;
  };

  // Assignment
  assignment: {
    type: AssignmentType;
    userId?: string;
    shiftId?: string;
    insertPosition?: 'start' | 'end' | 'after';
    afterTaskId?: string;
  };

  // Schedule
  schedule: {
    date: number; // timestamp
    dateOption: DateOption;
  };

  // Optional metadata
  reason?: BinChangeReasonCategory;
  notes?: string;
  createNoGoZone?: boolean;
}

export interface MoveRequestState {
  // Wizard flow
  step: WizardStep;
  mode: MoveMode;

  // Selected bins
  selectedBins: BinWithPriority[];

  // Per-bin configuration
  binConfigurations: {
    [binId: string]: BinConfiguration;
  };

  // Cached data (fetched for each bin)
  nearbyPotentialLocations: {
    [binId: string]: NearbyPotentialLocation[];
  };

  // UI state
  ui: {
    locationPickerBinId: string | null;
    loadingLocations: Set<string>;
    isSubmitting: boolean;
    isClosing: boolean;
  };
}

// ============================================================================
// Action Types
// ============================================================================

export type MoveRequestAction =
  // Wizard navigation
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_MODE'; mode: MoveMode }

  // Bin selection
  | { type: 'SELECT_BIN'; bin: BinWithPriority }
  | { type: 'DESELECT_BIN'; binId: string }
  | { type: 'SET_SELECTED_BINS'; bins: BinWithPriority[] }
  | { type: 'CLEAR_SELECTION' }

  // Bin configuration
  | { type: 'SET_MOVE_TYPE'; binId: string; moveType: MoveType }
  | { type: 'SET_DESTINATION'; binId: string; destination: Partial<BinConfiguration['destination']> }
  | { type: 'SET_ASSIGNMENT'; binId: string; assignment: Partial<BinConfiguration['assignment']> }
  | { type: 'SET_SCHEDULE'; binId: string; schedule: Partial<BinConfiguration['schedule']> }
  | { type: 'SET_METADATA'; binId: string; metadata: { reason?: BinChangeReasonCategory; notes?: string; createNoGoZone?: boolean } }
  | { type: 'UPDATE_BIN_CONFIG'; binId: string; updates: Partial<BinConfiguration> }

  // Potential locations
  | { type: 'SET_POTENTIAL_LOCATIONS'; binId: string; locations: NearbyPotentialLocation[] }
  | { type: 'START_LOADING_LOCATIONS'; binId: string }
  | { type: 'STOP_LOADING_LOCATIONS'; binId: string }

  // UI state
  | { type: 'OPEN_LOCATION_PICKER'; binId: string }
  | { type: 'CLOSE_LOCATION_PICKER' }
  | { type: 'SET_SUBMITTING'; isSubmitting: boolean }
  | { type: 'SET_CLOSING'; isClosing: boolean }

  // Bulk operations
  | { type: 'INITIALIZE_CONFIGS'; bins: BinWithPriority[]; mode: MoveMode }
  | { type: 'RESET_STATE' };

// ============================================================================
// Initial State
// ============================================================================

export const createInitialState = (
  initialBin?: BinWithPriority,
  initialBins?: BinWithPriority[]
): MoveRequestState => {
  const bins = initialBin ? [initialBin] : (initialBins || []);
  const mode: MoveMode = 'field_bins';

  return {
    step: 'selection',
    mode,
    selectedBins: bins,
    binConfigurations: {},
    nearbyPotentialLocations: {},
    ui: {
      locationPickerBinId: null,
      loadingLocations: new Set(),
      isSubmitting: false,
      isClosing: false,
    },
  };
};

// ============================================================================
// Reducer
// ============================================================================

export function moveRequestReducer(
  state: MoveRequestState,
  action: MoveRequestAction
): MoveRequestState {
  console.log('🔄 [REDUCER]', action.type, action);

  switch (action.type) {
    // ========================================================================
    // Wizard navigation
    // ========================================================================

    case 'SET_STEP':
      return { ...state, step: action.step };

    case 'SET_MODE': {
      console.log('🔄 [SET_MODE] Switching mode from', state.mode, 'to', action.mode);
      console.log('📊 [SET_MODE] Current selected bins:', state.selectedBins.length);
      console.log('📊 [SET_MODE] Current configs count:', Object.keys(state.binConfigurations).length);
      console.log('📦 [SET_MODE] Selected bin IDs:', state.selectedBins.map(b => `${b.id} (${b.status})`));

      // When switching modes, preserve ALL bins and configurations
      // Only auto-adjust moveType for bins to match their status
      const updatedConfigs: { [binId: string]: BinConfiguration } = {};

      Object.entries(state.binConfigurations).forEach(([binId, config]) => {
        const bin = config.bin;

        // Auto-adjust moveType if it doesn't match the bin's status
        let moveType = config.moveType;
        if (bin.status === 'in_storage') {
          // Warehouse bin should always be 'redeployment'
          moveType = 'redeployment';
        } else {
          // Field bin should be 'store' or 'relocation', never 'redeployment'
          if (config.moveType === 'redeployment') {
            moveType = 'store';
          }
        }

        console.log(`🔧 [SET_MODE] Bin ${binId}: status=${bin.status}, oldMoveType=${config.moveType}, newMoveType=${moveType}`);

        updatedConfigs[binId] = {
          ...config,
          moveType,
        };
      });

      console.log('✅ [SET_MODE] After update - selected bins:', state.selectedBins.length);
      console.log('✅ [SET_MODE] After update - configs count:', Object.keys(updatedConfigs).length);

      return {
        ...state,
        mode: action.mode,
        // ✅ Keep all selected bins regardless of mode
        selectedBins: state.selectedBins,
        // ✅ Keep all configurations, just update moveType
        binConfigurations: updatedConfigs,
      };
    }

    // ========================================================================
    // Bin selection
    // ========================================================================

    case 'SELECT_BIN': {
      const isAlreadySelected = state.selectedBins.some(b => b.id === action.bin.id);
      if (isAlreadySelected) return state;

      const newSelectedBins = [...state.selectedBins, action.bin];
      const defaultMoveType: MoveType = state.mode === 'warehouse_bins' ? 'redeployment' : 'store';
      const defaultDate = addDays(new Date(), 1).getTime();

      return {
        ...state,
        selectedBins: newSelectedBins,
        binConfigurations: {
          ...state.binConfigurations,
          [action.bin.id]: {
            bin: action.bin,
            moveType: defaultMoveType,
            destination: {
              type: 'custom',
            },
            assignment: {
              type: 'unassigned',
            },
            schedule: {
              date: defaultDate,
              dateOption: '24h',
            },
          },
        },
      };
    }

    case 'DESELECT_BIN': {
      const newConfigs = { ...state.binConfigurations };
      delete newConfigs[action.binId];

      return {
        ...state,
        selectedBins: state.selectedBins.filter(b => b.id !== action.binId),
        binConfigurations: newConfigs,
      };
    }

    case 'SET_SELECTED_BINS':
      return { ...state, selectedBins: action.bins };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedBins: [],
        binConfigurations: {},
      };

    // ========================================================================
    // Bin configuration
    // ========================================================================

    case 'SET_MOVE_TYPE': {
      const config = state.binConfigurations[action.binId];
      if (!config) return state;

      return {
        ...state,
        binConfigurations: {
          ...state.binConfigurations,
          [action.binId]: {
            ...config,
            moveType: action.moveType,
          },
        },
      };
    }

    case 'SET_DESTINATION': {
      const config = state.binConfigurations[action.binId];
      if (!config) return state;

      return {
        ...state,
        binConfigurations: {
          ...state.binConfigurations,
          [action.binId]: {
            ...config,
            destination: {
              ...config.destination,
              ...action.destination,
            },
          },
        },
      };
    }

    case 'SET_ASSIGNMENT': {
      const config = state.binConfigurations[action.binId];
      if (!config) return state;

      return {
        ...state,
        binConfigurations: {
          ...state.binConfigurations,
          [action.binId]: {
            ...config,
            assignment: {
              ...config.assignment,
              ...action.assignment,
            },
          },
        },
      };
    }

    case 'SET_SCHEDULE': {
      const config = state.binConfigurations[action.binId];
      if (!config) return state;

      return {
        ...state,
        binConfigurations: {
          ...state.binConfigurations,
          [action.binId]: {
            ...config,
            schedule: {
              ...config.schedule,
              ...action.schedule,
            },
          },
        },
      };
    }

    case 'SET_METADATA': {
      const config = state.binConfigurations[action.binId];
      if (!config) return state;

      return {
        ...state,
        binConfigurations: {
          ...state.binConfigurations,
          [action.binId]: {
            ...config,
            ...action.metadata,
          },
        },
      };
    }

    case 'UPDATE_BIN_CONFIG': {
      const config = state.binConfigurations[action.binId];
      if (!config) return state;

      return {
        ...state,
        binConfigurations: {
          ...state.binConfigurations,
          [action.binId]: {
            ...config,
            ...action.updates,
            // Deep merge nested objects
            destination: action.updates.destination
              ? { ...config.destination, ...action.updates.destination }
              : config.destination,
            assignment: action.updates.assignment
              ? { ...config.assignment, ...action.updates.assignment }
              : config.assignment,
            schedule: action.updates.schedule
              ? { ...config.schedule, ...action.updates.schedule }
              : config.schedule,
          },
        },
      };
    }

    // ========================================================================
    // Potential locations
    // ========================================================================

    case 'SET_POTENTIAL_LOCATIONS':
      return {
        ...state,
        nearbyPotentialLocations: {
          ...state.nearbyPotentialLocations,
          [action.binId]: action.locations,
        },
      };

    case 'START_LOADING_LOCATIONS': {
      const newSet = new Set(state.ui.loadingLocations);
      newSet.add(action.binId);
      return {
        ...state,
        ui: { ...state.ui, loadingLocations: newSet },
      };
    }

    case 'STOP_LOADING_LOCATIONS': {
      const newSet = new Set(state.ui.loadingLocations);
      newSet.delete(action.binId);
      return {
        ...state,
        ui: { ...state.ui, loadingLocations: newSet },
      };
    }

    // ========================================================================
    // UI state
    // ========================================================================

    case 'OPEN_LOCATION_PICKER':
      return {
        ...state,
        ui: { ...state.ui, locationPickerBinId: action.binId },
      };

    case 'CLOSE_LOCATION_PICKER':
      return {
        ...state,
        ui: { ...state.ui, locationPickerBinId: null },
      };

    case 'SET_SUBMITTING':
      return {
        ...state,
        ui: { ...state.ui, isSubmitting: action.isSubmitting },
      };

    case 'SET_CLOSING':
      return {
        ...state,
        ui: { ...state.ui, isClosing: action.isClosing },
      };

    // ========================================================================
    // Bulk operations
    // ========================================================================

    case 'INITIALIZE_CONFIGS': {
      console.log('🎬 [INITIALIZE_CONFIGS] Initializing configs for', action.bins.length, 'bins in mode:', action.mode);
      console.log('📦 [INITIALIZE_CONFIGS] Existing configs:', Object.keys(state.binConfigurations).length);

      const defaultDate = addDays(new Date(), 1).getTime();
      const defaultMoveType: MoveType = action.mode === 'warehouse_bins' ? 'redeployment' : 'store';
      const newConfigs = { ...state.binConfigurations };

      action.bins.forEach(bin => {
        if (!newConfigs[bin.id]) {
          console.log(`➕ [INITIALIZE_CONFIGS] Creating config for bin ${bin.bin_number} (${bin.status})`);
          newConfigs[bin.id] = {
            bin,
            moveType: defaultMoveType,
            destination: {
              type: 'custom',
            },
            assignment: {
              type: 'unassigned',
            },
            schedule: {
              date: defaultDate,
              dateOption: '24h',
            },
          };
        } else {
          console.log(`✓ [INITIALIZE_CONFIGS] Config already exists for bin ${bin.bin_number}`);
        }
      });

      console.log('✅ [INITIALIZE_CONFIGS] Total configs after init:', Object.keys(newConfigs).length);

      return {
        ...state,
        binConfigurations: newConfigs,
      };
    }

    case 'RESET_STATE':
      return createInitialState();

    default:
      return state;
  }
}
