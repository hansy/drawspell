export const SNAP_GRID_SIZE = 30;
export const SNAP_THRESHOLD = 0.5;

export const snapToGrid = (value: number): number => {
    return Math.floor(value / SNAP_GRID_SIZE + SNAP_THRESHOLD) * SNAP_GRID_SIZE;
};

export const getSnappedPosition = (x: number, y: number) => {
    return {
        x: snapToGrid(x),
        y: snapToGrid(y)
    };
};
