import { v4 as uuidv4 } from 'uuid';
import { Card, PlayerId, ZoneId } from '../types';

interface ParsedCard {
    quantity: number;
    name: string;
    set: string;
    collectorNumber: string;
}

interface ScryfallCard {
    id: string;
    name: string;
    set: string;
    collector_number: string;
    image_uris?: {
        normal: string;
    };
    card_faces?: {
        image_uris: {
            normal: string;
        }
    }[];
    type_line: string;
    oracle_text: string;
}

export const parseDeckList = (text: string): ParsedCard[] => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const cards: ParsedCard[] = [];

    // Regex to match: 
    // 1. Quantity (optional, default 1)
    // 2. Name
    // 3. Set Code (optional)
    // 4. Collector Number (optional)

    // Examples:
    // 1 Sol Ring (CMD) 123
    // 1x Sol Ring
    // Sol Ring
    // 1 Sol Ring

    lines.forEach(line => {
        // Skip sideboards/empty lines if not filtered already
        if (line.toLowerCase().startsWith('sideboard')) return;

        // Try full match first: 1 Sol Ring (SET) 123
        const fullMatch = line.match(/^(\d+x?)\s+(.+?)\s+\(([A-Z0-9]{3,})\)\s+(\d+).*$/i);

        if (fullMatch) {
            cards.push({
                quantity: parseInt(fullMatch[1].replace('x', ''), 10),
                name: fullMatch[2].trim(),
                set: fullMatch[3].toLowerCase(),
                collectorNumber: fullMatch[4],
            });
        } else {
            // Fallback: Quantity + Name OR Just Name
            const simpleMatch = line.match(/^(\d+x?)?\s*(.+)$/);

            if (simpleMatch) {
                const quantityStr = simpleMatch[1];
                const quantity = quantityStr ? parseInt(quantityStr.replace('x', ''), 10) : 1;
                const name = simpleMatch[2].trim();

                cards.push({
                    quantity,
                    name,
                    set: '',
                    collectorNumber: '',
                });
            }
        }
    });

    return cards;
};

export const fetchScryfallCards = async (parsedCards: ParsedCard[]): Promise<Partial<Card>[]> => {
    const identifiers = parsedCards.map(card => {
        if (card.set && card.collectorNumber) {
            return { set: card.set, collector_number: card.collectorNumber };
        }
        return { name: card.name };
    });

    // Scryfall collection API limit is 75 identifiers per request
    const chunks = [];
    for (let i = 0; i < identifiers.length; i += 75) {
        chunks.push(identifiers.slice(i, i + 75));
    }

    const fetchedCards: Partial<Card>[] = [];

    for (const chunk of chunks) {
        try {
            const response = await fetch('https://api.scryfall.com/cards/collection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ identifiers: chunk }),
            });

            if (!response.ok) {
                console.error('Scryfall API error:', response.statusText);
                continue;
            }

            const data = await response.json();

            // Map found cards back to quantities
            data.data.forEach((scryfallCard: ScryfallCard) => {
                // Find original request to get quantity
                // This is a bit fuzzy because Scryfall might return a different version if we searched by name
                // But if we searched by set/cn it should be exact.

                // Simple matching strategy:
                const originalRequest = parsedCards.find(pc =>
                    (pc.set === scryfallCard.set && pc.collectorNumber === scryfallCard.collector_number) ||
                    (pc.name === scryfallCard.name)
                );

                if (originalRequest) {
                    for (let i = 0; i < originalRequest.quantity; i++) {
                        const imageUrl = scryfallCard.image_uris?.normal || scryfallCard.card_faces?.[0]?.image_uris?.normal;

                        fetchedCards.push({
                            name: scryfallCard.name,
                            imageUrl: imageUrl,
                            typeLine: scryfallCard.type_line,
                            oracleText: scryfallCard.oracle_text,
                            scryfallId: scryfallCard.id,
                            tapped: false,
                            faceDown: false,
                            rotation: 0,
                            counters: [],
                            position: { x: 0, y: 0 },
                        });
                    }
                }
            });

        } catch (error) {
            console.error('Error fetching from Scryfall:', error);
        }
    }

    return fetchedCards;
};

export const createCardFromImport = (cardData: Partial<Card>, ownerId: PlayerId, zoneId: ZoneId): Card => {
    return {
        id: uuidv4(),
        ownerId,
        controllerId: ownerId,
        zoneId,
        name: cardData.name || 'Unknown Card',
        imageUrl: cardData.imageUrl,
        typeLine: cardData.typeLine,
        oracleText: cardData.oracleText,
        scryfallId: cardData.scryfallId,
        tapped: false,
        faceDown: false,
        rotation: 0,
        counters: [],
        position: { x: 0, y: 0 },
        ...cardData
    };
};
