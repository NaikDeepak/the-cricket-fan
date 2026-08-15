"""Quora Anecdotes & Dressing Room Memoirs Harvester.

Curates legendary dressing room tales, player autobiographies, famous sledges,
and behind-the-scenes masterclasses from Quora, memoirs, and player interviews.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

QUORA_MEMOIRS_STORIES: list[dict[str, Any]] = [
    {
        "content_key": "anecdote:viv-richards-5-point-5-ounces",
        "title": "Viv Richards: 'It's Red, Round and 5.5 Ounces'",
        "summary": "Glamorgan bowler Greg Thomas beat Viv Richards' bat several times and sledged him — only for Viv to hit the next ball out of the stadium.",
        "category": "anecdote",
        "format": "single",
        "teams": ["Somerset", "Glamorgan"],
        "players": ["Viv Richards", "Greg Thomas"],
        "venue": "Taunton",
        "year": 1980,
        "match_format": "County",
        "tags": ["sledge", "viv_richards", "banter", "quora"],
        "source": "quora:greatest-sledges-in-cricket",
        "source_type": "quora",
        "source_ref": "https://www.quora.com/What-are-some-of-the-greatest-sledges-in-cricket-history",
        "segments": [
            "🏏 County Lore (Quora): Fast bowler Greg Thomas beat Viv Richards' outside edge twice and taunted: 'It's red, round and weighs about 5 ounces, in case you were wondering!' Viv dispatched the next ball out of the stadium into a nearby river: 'You know what it looks like, now go find it!' #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "anecdote:kumble-broken-jaw-antigua-2002",
        "title": "Anil Kumble Bowling With a Broken Jaw (2002)",
        "summary": "Fractured by a Mervyn Dillon bouncer, Anil Kumble emerged from the dressing room with his face heavily bandaged to bowl 14 consecutive overs and dismiss Brian Lara.",
        "category": "anecdote",
        "format": "single",
        "teams": ["India", "West Indies"],
        "players": ["Anil Kumble", "Brian Lara", "Mervyn Dillon"],
        "venue": "Antigua Recreation Ground",
        "year": 2002,
        "match_format": "Test",
        "tags": ["grit", "kumble", "courage", "memoir"],
        "source": "memoir:cricket-autobiographies",
        "source_type": "memoir",
        "source_ref": "https://www.espncricinfo.com/story/kumble-breaks-jaw-then-takes-lara-wicket-118833",
        "event_month_day": "05-12",
        "segments": [
            "🏏 Antigua 2002 (Memoir): After suffering a broken jaw from a Dillon bouncer, Anil Kumble was scheduled for surgery. Instead, he wrapped his face in thick white bandages, came onto the field, bowled 14 heroic overs, and trapped Brian Lara LBW! #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "anecdote:sachin-sandstorm-speech-1998",
        "title": "Sachin's Sandstorm Meeting: 'We Are Winning This'",
        "summary": "During the sandstorm break in Sharjah, the Indian team discussed net run rates to qualify for the final. Sachin Tendulkar stopped them and said: 'Forget qualifying, we are winning the match.'",
        "category": "anecdote",
        "format": "single",
        "teams": ["India", "Australia"],
        "players": ["Sachin Tendulkar", "Mohammad Azharuddin"],
        "venue": "Sharjah Cricket Stadium",
        "year": 1998,
        "match_format": "ODI",
        "tags": ["sachin", "sharjah", "dressing_room", "interview"],
        "source": "interview:sachin-playing-it-my-way",
        "source_type": "interview",
        "source_ref": "Autobiography: Playing It My Way (Sachin Tendulkar)",
        "event_month_day": "04-22",
        "segments": [
            "🏏 Sharjah 1998 (Interview): Inside the dressing room during the sandstorm, Indian batsmen were calculating net run-rate equations. Sachin interrupted: 'Stop calculating 237 to qualify. We are going to chase down 276 and beat Australia directly!' #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "anecdote:dhoni-joginder-pep-talk-2007",
        "title": "MS Dhoni to Joginder: 'Whatever Happens, I'm With You'",
        "summary": "When handing rookie Joginder Sharma the high-stakes final over against Misbah in 2007, Dhoni relieved all pressure with calm leadership.",
        "category": "anecdote",
        "format": "single",
        "teams": ["India", "Pakistan"],
        "players": ["MS Dhoni", "Joginder Sharma"],
        "venue": "Wanderers Stadium, Johannesburg",
        "year": 2007,
        "match_format": "T20",
        "tags": ["dhoni", "leadership", "dressing_room", "interview"],
        "source": "interview:joginder-sharma-2007",
        "source_type": "interview",
        "source_ref": "https://www.quora.com/What-did-MS-Dhoni-say-to-Joginder-Sharma-in-the-2007-T20-WC-final",
        "event_month_day": "09-24",
        "segments": [
            "🏏 Johannesburg 2007 (Interview): Joginder Sharma was nervous. MS Dhoni walked up, put his arm around him and said: 'You have bowled so many overs in domestic cricket with passion. Just bowl your normal ball. If we lose, I will take the blame.' Joginder delivered history. #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "anecdote:yuvraj-blood-vomit-wc-2011",
        "title": "Yuvraj Singh's 2011 World Cup: 'Either The Cup Or My Life'",
        "summary": "Battling undiagnosed cancer and vomiting blood in the Chennai heat against West Indies, Yuvraj Singh refused to leave the field, scoring a match-winning 113 and taking 2 wickets.",
        "category": "anecdote",
        "format": "single",
        "teams": ["India", "West Indies"],
        "players": ["Yuvraj Singh"],
        "venue": "MA Chidambaram Stadium, Chennai",
        "year": 2011,
        "match_format": "ODI",
        "tags": ["yuvraj_singh", "world_cup", "grit", "memoir"],
        "source": "memoir:the-test-of-my-life-yuvraj",
        "source_type": "memoir",
        "source_ref": "Book: The Test of My Life (Yuvraj Singh)",
        "event_month_day": "03-20",
        "segments": [
            "🏏 Chennai 2011 (Memoir): In suffocating 38°C heat vs West Indies, Yuvraj Singh was vomiting blood on the pitch between overs. He told the physio: 'God can take my life, but I must take India to the World Cup.' He scored 113 and took 2/18 to win Man of the Match! #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "anecdote:ganguly-waugh-toss-delay-2001",
        "title": "Ganguly Making Steve Waugh Wait for the Toss",
        "summary": "Sourav Ganguly deliberately arrived late for the toss against Australian captain Steve Waugh to break Australia's psychological dominance.",
        "category": "anecdote",
        "format": "single",
        "teams": ["India", "Australia"],
        "players": ["Sourav Ganguly", "Steve Waugh"],
        "venue": "Eden Gardens, Kolkata",
        "year": 2001,
        "match_format": "Test",
        "tags": ["ganguly", "steve_waugh", "mind_games", "quora"],
        "source": "quora:sourav-ganguly-steve-waugh-toss",
        "source_type": "quora",
        "source_ref": "https://www.quora.com/Why-did-Sourav-Ganguly-make-Steve-Waugh-wait-for-the-toss",
        "segments": [
            "🏏 Kolkata 2001 (Quora): Tired of Australia's psychological intimidation, Sourav Ganguly walked out late for the toss in a blazer while Steve Waugh stood waiting in the sun. Steve Waugh admitted years later: 'It annoyed the hell out of me!' #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "anecdote:mcgrath-eddo-brandes-biscuit-sledge",
        "title": "Glenn McGrath vs Eddo Brandes: The Biscuit Sledge",
        "summary": "Glenn McGrath asked Zimbabwe tailender Eddo Brandes why he was so fat, and received the most witty retort in cricket history.",
        "category": "anecdote",
        "format": "single",
        "teams": ["Australia", "Zimbabwe"],
        "players": ["Glenn McGrath", "Eddo Brandes"],
        "venue": "Harare Sports Club",
        "year": 1999,
        "match_format": "ODI",
        "tags": ["sledge", "banter", "mcgrath", "quora"],
        "source": "quora:funniest-cricket-sledges",
        "source_type": "quora",
        "source_ref": "https://www.quora.com/What-is-the-funniest-sledge-in-cricket-history",
        "segments": [
            "🏏 Harare 1999 (Quora): Frustrated by Zimbabwe No.11 Eddo Brandes playing and missing, Glenn McGrath barked: 'Why are you so fat?!' Brandes instantly replied without hesitation: 'Because every time I make love to your wife, she gives me a biscuit!' Even Australian slip fielders collapsed in laughter! #Cricket #TheCricketFan",
        ],
    },
]


def harvest_quora_memoirs() -> list[dict[str, Any]]:
    """Return all curated Quora anecdotes, memoirs, and dressing room stories."""
    return QUORA_MEMOIRS_STORIES
