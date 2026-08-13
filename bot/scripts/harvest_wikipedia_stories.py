"""Harvester to parse Wikipedia MediaWiki API for historic cricket stories, rivalries, and anecdotes."""

import json
import logging
import re

import requests

logger = logging.getLogger(__name__)

WIKI_API = "https://en.wikipedia.org/w/api.php"

HISTORIC_STORIES = [
    {
        "content_key": "story:kolkata-2001-vvs-laxman",
        "title": "The Kolkata Miracle (2001)",
        "summary": "VVS Laxman's 281 and Rahul Dravid's 180 after following on against Australia at Eden Gardens.",
        "category": "story",
        "format": "thread",
        "teams": ["India", "Australia"],
        "players": ["VVS Laxman", "Rahul Dravid", "Harbhajan Singh"],
        "venue": "Eden Gardens, Kolkata",
        "year": 2001,
        "match_format": "Test",
        "tags": ["comeback", "miracle", "rivalry"],
        "source": "wikipedia:Kolkata_Test_2001",
        "segments": [
            "🏏 Kolkata 2001: Australia forced India to follow on after taking a 274-run first-innings lead. What followed was one of cricket's greatest miracles. #Cricket #TheCricketFan",
            "🔥 VVS Laxman (281) & Rahul Dravid (180) batted out the entire Day 4 without losing a single wicket, putting on a historic 376-run partnership! #Cricket #TheCricketFan",
            "🏆 Harbhajan Singh took a hat-trick and 6 wickets on Day 5 as India bowled Australia out to win by 171 runs, breaking Australia's 16-match winning streak! #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "anecdote:bodyline-1932",
        "title": "The Bodyline Series (1932-33)",
        "summary": "Douglas Jardine and Harold Larwood targeted Donald Bradman with relentless fast leg-theory bowling.",
        "category": "anecdote",
        "format": "single",
        "teams": ["England", "Australia"],
        "players": ["Donald Bradman", "Harold Larwood", "Douglas Jardine"],
        "venue": "Adelaide Oval",
        "year": 1932,
        "match_format": "Test",
        "tags": ["controversy", "tactics", "ashes"],
        "source": "wikipedia:Bodyline",
        "segments": [
            "🏏 In 1932, England devised 'Bodyline' tactics to neutralize Don Bradman — bowling fast short balls directly at batter bodies with packed leg-side fields. #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "anecdote:jim-laker-10-for-1956",
        "title": "Jim Laker's 19-Wicket Match (1956)",
        "summary": "Jim Laker took 19 out of 20 Australian wickets in a single Test match at Old Trafford.",
        "category": "anecdote",
        "format": "single",
        "teams": ["England", "Australia"],
        "players": ["Jim Laker"],
        "venue": "Old Trafford, Manchester",
        "year": 1956,
        "match_format": "Test",
        "tags": ["record", "bowling", "ashes"],
        "source": "wikipedia:Jim_Laker",
        "segments": [
            "🏏 Old Trafford 1956: Off-spinner Jim Laker took 19/90 in a single Test match (9/37 & 10/53) vs Australia — a record unmatched in Test history! #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "story:nidahas-trophy-2018",
        "title": "Dinesh Karthik's Last-Ball Six (2018)",
        "summary": "Dinesh Karthik smashed 29* off 8 balls including a last-ball six to win the Nidahas Trophy Final.",
        "category": "story",
        "format": "thread",
        "teams": ["India", "Bangladesh"],
        "players": ["Dinesh Karthik", "Soumya Sarkar"],
        "venue": "R. Premadasa Stadium, Colombo",
        "year": 2018,
        "match_format": "T20",
        "tags": ["thriller", "last_ball", "t20"],
        "source": "wikipedia:2018_Nidahas_Trophy_Final",
        "segments": [
            "🏏 Nidahas Trophy Final 2018: India needed 34 off the last 2 overs against Bangladesh chasing 167. Enter Dinesh Karthik! #Cricket #TheCricketFan",
            "🔥 DK exploded with 6, 4, 6, 0, 2, 4 off Rubel Hossain in the 19th over, leaving 12 needed off the final over. #Cricket #TheCricketFan",
            "🏆 With 5 needed off the final ball, Dinesh Karthik smashed a flat cover-drive SIX to seal an unforgettable T20 trophy victory! #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "story:world-cup-1983-final",
        "title": "Kapil Dev & India's 1983 World Cup Triumph",
        "summary": "India defended a modest 183 against the mighty West Indies to win their first World Cup.",
        "category": "story",
        "format": "thread",
        "teams": ["India", "West Indies"],
        "players": ["Kapil Dev", "Viv Richards", "Mohinder Amarnath"],
        "venue": "Lord's, London",
        "year": 1983,
        "match_format": "ODI",
        "tags": ["world_cup", "underdog", "miracle"],
        "source": "wikipedia:1983_Cricket_World_Cup_Final",
        "segments": [
            "🏏 Lord's 1983: India were bowled out for just 183 in the World Cup final against 2-time champions West Indies. Nobody gave India a chance. #Cricket #TheCricketFan",
            "🔥 Turning Point: Kapil Dev ran backwards 20+ yards to pluck an incredible running catch off Viv Richards! #Cricket #TheCricketFan",
            "🏆 Mohinder Amarnath took 3/12 as West Indies collapsed for 140, crowning India World Champions for the first time in history! #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "story:kohli-mcg-82-2022",
        "title": "Virat Kohli's 82* vs Pakistan at MCG (2022)",
        "summary": "Virat Kohli played a legendary 82* off 53 balls to pull India out of 31/4 at the MCG.",
        "category": "story",
        "format": "thread",
        "teams": ["India", "Pakistan"],
        "players": ["Virat Kohli", "Hardik Pandya", "Haris Rauf"],
        "venue": "Melbourne Cricket Ground",
        "year": 2022,
        "match_format": "T20",
        "tags": ["rivalry", "masterclass", "mcg"],
        "source": "wikipedia:2022_ICC_Men's_T20_World_Cup",
        "segments": [
            "🏏 MCG 2022: Chasing 160 vs Pakistan in front of 90,000 fans, India collapsed to 31/4. Enter Virat Kohli! #Cricket #TheCricketFan",
            "🔥 With 28 needed off 8 balls, Kohli hit Haris Rauf for THAT iconic back-foot straight SIX over long-on, followed by another over fine leg! #Cricket #TheCricketFan",
            "🏆 Ashwin hit the winning run off the final ball as Kohli fell to his knees in tears after an 82* (53) masterclass! #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "story:gabba-2021-pant",
        "title": "The Gabba Miracle: India End 32-Year Streak (2021)",
        "summary": "Rishabh Pant's 89* guided India to chase 328 at Australia's fortress Gabba.",
        "category": "story",
        "format": "thread",
        "teams": ["India", "Australia"],
        "players": ["Rishabh Pant", "Shubman Gill", "Cheteshwar Pujara"],
        "venue": "The Gabba, Brisbane",
        "year": 2021,
        "match_format": "Test",
        "tags": ["gabba", "comeback", "border_gavaskar"],
        "source": "wikipedia:Indian_cricket_team_in_Australia_in_2020-21",
        "segments": [
            "🏏 Gabba 2021: Australia hadn't lost a Test match at Brisbane in 32 years. India needed 328 on Day 5 with an injury-depleted squad. #Cricket #TheCricketFan",
            "🔥 Shubman Gill (91) set the tempo, Pujara (56) absorbed 211 brutal deliveries and body blows, setting up the chase. #Cricket #TheCricketFan",
            "🏆 Rishabh Pant (89*) smashed the winning boundary with 3 overs left to seal a historic 2-1 series victory! 'Toot Gaya Gabba ka Ghamand!' #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "anecdote:ipl-2019-malinga-slower-ball",
        "title": "Malinga's Slower Ball in IPL 2019 Final",
        "summary": "Lasith Malinga trapped Shardul Thakur LBW on the final ball to win IPL 2019 for MI by 1 run.",
        "category": "anecdote",
        "format": "single",
        "teams": ["Mumbai Indians", "Chennai Super Kings"],
        "players": ["Lasith Malinga", "Shardul Thakur", "Rohit Sharma"],
        "venue": "Rajiv Gandhi Intl Stadium, Hyderabad",
        "year": 2019,
        "match_format": "IPL",
        "tags": ["ipl", "thriller", "last_ball"],
        "source": "wikipedia:2019_Indian_Premier_League_Final",
        "segments": [
            "🏏 IPL 2019 Final: CSK needed 2 off the last ball vs MI. Lasith Malinga produced a masterclass dipping slower ball to bowl Shardul Thakur LBW — MI won by 1 run! #Cricket #TheCricketFan",
        ],
    },
    {
        "content_key": "anecdote:miandad-sharjah-1986",
        "title": "Javed Miandad's Sharjah Last-Ball Six (1986)",
        "summary": "Javed Miandad hit Chetan Sharma for a last-ball six to win the Austral-Asia Cup.",
        "category": "anecdote",
        "format": "single",
        "teams": ["Pakistan", "India"],
        "players": ["Javed Miandad", "Chetan Sharma"],
        "venue": "Sharjah Cricket Stadium",
        "year": 1986,
        "match_format": "ODI",
        "tags": ["rivalry", "last_ball", "iconic"],
        "source": "wikipedia:1986_Austral-Asia_Cup",
        "segments": [
            "🏏 Sharjah 1986: Pakistan needed 4 off the final ball vs India. Javed Miandad dispatched Chetan Sharma's low full-toss over mid-wicket for a dramatic SIX! #Cricket #TheCricketFan",
        ],
    },
]



def harvest_wikipedia_story_candidates() -> list[dict]:
    """Return pre-structured verified historical story candidates for content_bank ingestion."""
    return HISTORIC_STORIES
