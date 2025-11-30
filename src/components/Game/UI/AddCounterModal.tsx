import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { useGameStore } from '../../../store/gameStore';
import { Counter } from '../../../types';
import { cn } from '../../../lib/utils';
import { PRESET_COUNTERS, resolveCounterColor } from '../../../lib/counters';

interface AddCounterModalProps {
    isOpen: boolean;
    onClose: () => void;
    cardId: string;
}

export const AddCounterModal: React.FC<AddCounterModalProps> = ({ isOpen, onClose, cardId }) => {
    const [selectedType, setSelectedType] = useState<string>('+1/+1');
    const [customType, setCustomType] = useState('');
    const [count, setCount] = useState(1);

    const addCounterToCard = useGameStore(state => state.addCounterToCard);
    const addGlobalCounter = useGameStore(state => state.addGlobalCounter);
    const globalCounters = useGameStore(state => state.globalCounters);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setSelectedType('+1/+1');
            setCustomType('');
            setCount(1);
        }
    }, [isOpen]);

    // When selecting a preset or global counter, update the custom input to reflect it
    // This allows the user to see what they picked in the "input box at top"
    const handleSelectType = (type: string) => {
        setSelectedType('custom');
        setCustomType(type);
    };

    const handleAdd = () => {
        const type = selectedType === 'custom' ? customType.trim() : selectedType;
        if (!type) return;

        const color = resolveCounterColor(type, globalCounters);

        const counter: Counter = {
            type,
            count,
            color
        };

        addCounterToCard(cardId, counter);

        // Always ensure the used counter is in the global list with its color
        if (!globalCounters[type]) {
            addGlobalCounter(type, color);
        }

        onClose();
    };

    // Get list of unique counter types (presets + globals)
    const allCounterTypes = Array.from(new Set([
        ...PRESET_COUNTERS.map(p => p.type),
        ...Object.keys(globalCounters)
    ])).sort();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle>Add Counter</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Top Row: Input Box and Count */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label htmlFor="customName" className="text-xs font-medium text-zinc-400 mb-1 block">
                                Counter Name
                            </label>
                            <Input
                                id="customName"
                                value={customType}
                                onChange={(e) => {
                                    setSelectedType('custom');
                                    setCustomType(e.target.value);
                                }}
                                className="bg-zinc-800 border-zinc-700 w-full"
                                placeholder="e.g. +1/+1, Poison"
                                autoFocus
                            />
                        </div>
                        <div className="w-24">
                            <label htmlFor="count" className="text-xs font-medium text-zinc-400 mb-1 block">
                                Count
                            </label>
                            <Input
                                id="count"
                                type="number"
                                min={1}
                                value={count}
                                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                                className="bg-zinc-800 border-zinc-700 w-full"
                            />
                        </div>
                    </div>

                    {/* List of Counters */}
                    <div>
                        <label className="text-xs font-medium text-zinc-400 mb-2 block">
                            Quick Select
                        </label>
                        <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-1">
                            {allCounterTypes.map(type => {
                                const color = resolveCounterColor(type, globalCounters);

                                return (
                                    <Button
                                        key={type}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSelectType(type)}
                                        className={cn(
                                            "capitalize border-zinc-700 text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white",
                                            customType === type ? "ring-2 ring-indigo-500 border-transparent bg-zinc-700" : ""
                                        )}
                                    >
                                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }} />
                                        {type}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAdd}
                        disabled={selectedType === 'custom' && !customType.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        Add Counter
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
