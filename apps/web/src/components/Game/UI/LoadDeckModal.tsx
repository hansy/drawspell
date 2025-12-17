import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { toast } from 'sonner';
import { parseDeckList, fetchScryfallCards, createCardFromImport, validateDeckListLimits, validateImportResult } from '../../../utils/deckImport';
import { useGameStore } from '../../../store/gameStore';
import { ZONE } from '../../../constants/zones';
import { getZoneByType } from '../../../lib/gameSelectors';
import { batchSharedMutations, getYDocHandles, getYProvider } from '../../../yjs/docManager';
import { useClientPrefsStore } from '../../../store/clientPrefsStore';
import { cn } from '../../../lib/utils';


interface LoadDeckModalProps {
    isOpen: boolean;
    onClose: () => void;
    playerId: string;
}

export const LoadDeckModal: React.FC<LoadDeckModalProps> = ({ isOpen, onClose, playerId }) => {
    const [importText, setImportText] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [prefilledFromLastImport, setPrefilledFromLastImport] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const wasOpenRef = useRef(false);

    const addCard = useGameStore((state) => state.addCard);
    const setDeckLoaded = useGameStore((state) => state.setDeckLoaded);
    const shuffleLibrary = useGameStore((state) => state.shuffleLibrary);
    const zones = useGameStore((state) => state.zones);

    const lastImportedDeckText = useClientPrefsStore((state) => state.lastImportedDeckText);
    const setLastImportedDeckText = useClientPrefsStore((state) => state.setLastImportedDeckText);

    useEffect(() => {
        const justOpened = isOpen && !wasOpenRef.current;
        wasOpenRef.current = isOpen;
        if (!justOpened) return;

        setError(null);

        const stored = (lastImportedDeckText ?? '').trim();
        if (stored) {
            setImportText(stored);
            setPrefilledFromLastImport(true);
            setTimeout(() => {
                textareaRef.current?.focus();
                textareaRef.current?.select();
            }, 0);
        } else {
            setPrefilledFromLastImport(false);
            setTimeout(() => textareaRef.current?.focus(), 0);
        }
    }, [isOpen, lastImportedDeckText]);

    const handleImport = async () => {
        if (!importText.trim()) return;

        const handles = getYDocHandles();
        const provider = getYProvider() as any;
        const providerReady = Boolean(handles && provider && (provider.wsconnected || provider.synced));
        if (!providerReady) {
            toast.error('Connecting to multiplayer, please wait a moment then try again.');
            return;
        }

        setIsImporting(true);
        setError(null);

        try {
            const parsedDeck = parseDeckList(importText);
            if (parsedDeck.length === 0) {
                throw new Error("No valid cards found in the list.");
            }

            const sizeValidation = validateDeckListLimits(parsedDeck);
            if (!sizeValidation.ok) {
                throw new Error(sizeValidation.error);
            }

            const fetchResult = await fetchScryfallCards(parsedDeck);
            const validation = validateImportResult(parsedDeck, fetchResult);

            if (!validation.ok) {
                throw new Error(validation.error);
            }

            if (validation.warnings.length) {
                toast.warning('Imported with warnings', {
                    description: validation.warnings.join('\n'),
                });
            }

            // Chunk into multiple transactions to avoid oversized websocket messages.
            const libraryZone = getZoneByType(zones, playerId, ZONE.LIBRARY);
            const commanderZone = getZoneByType(zones, playerId, ZONE.COMMANDER);
            const libraryZoneId = libraryZone?.id ?? `${playerId}-${ZONE.LIBRARY}`;
            const commanderZoneId = commanderZone?.id ?? `${playerId}-${ZONE.COMMANDER}`;

            const CHUNK_SIZE = 20;
            for (let i = 0; i < fetchResult.cards.length; i += CHUNK_SIZE) {
                const chunk = fetchResult.cards.slice(i, i + CHUNK_SIZE);
                batchSharedMutations(() => {
                    chunk.forEach(cardData => {
                        const zoneId = cardData.section === 'commander' ? commanderZoneId : libraryZoneId;
                        const newCard = createCardFromImport(cardData, playerId, zoneId);
                        if (zoneId === libraryZoneId) {
                            newCard.faceDown = true;
                        }
                        addCard(newCard);
                    });
                });
            }

            batchSharedMutations(() => {
                setDeckLoaded(playerId, true);
                shuffleLibrary(playerId, playerId);
            });
            toast.success("Deck successfully loaded");
            setLastImportedDeckText(importText);
            setImportText('');
            onClose();
        } catch (err: any) {
            console.error('Import failed:', err);
            setError(err.message || 'Failed to import deck. Please check the format.');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle>Load Deck</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Paste your decklist below (e.g., "4 Lightning Bolt").
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <textarea
                        ref={textareaRef}
                        value={importText}
                        onChange={(e) => {
                            if (prefilledFromLastImport) setPrefilledFromLastImport(false);
                            setImportText(e.target.value);
                        }}
                        placeholder="4 Lightning Bolt&#10;20 Mountain..."
                        className={cn(
                            "w-full h-64 bg-zinc-900 border border-zinc-800 rounded-md p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none placeholder:text-zinc-600",
                            prefilledFromLastImport && "ring-2 ring-amber-500/30 border-amber-500/50"
                        )}
                    />

                    {prefilledFromLastImport && (
                        <div className="text-amber-200/80 text-xs bg-amber-950/30 p-2 rounded border border-amber-900/50">
                            Loaded your last imported deck — paste to replace.
                        </div>
                    )}

                    {error && (
                        <div className="text-red-400 text-sm bg-red-950/30 p-2 rounded border border-red-900/50">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isImporting} className="border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                        Cancel
                    </Button>
                    <Button onClick={handleImport} disabled={isImporting || !importText.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                        {isImporting ? 'Loading...' : 'Load Deck'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
