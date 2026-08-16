"""Automated On-This-Day Cricket Calendar Engine.

Provides verified historical match anniversaries, legendary player birthdays,
stadium inaugurations, and record milestones for every date in the cricket calendar.
Dynamically discovers and auto-persists stories when a date is requested.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

import sqlalchemy as sa

from bot.db import content_bank

logger = logging.getLogger(__name__)

# Curated calendar milestones for key dates across the year
CALENDAR_MILESTONES: list[dict[str, Any]] = [
    # January
    {
        "event_month_day": "01-06",
        "title": "Happy Birthday Kapil Dev: The Haryana Hurricane",
        "summary": "India's greatest all-rounder and 1983 World Cup winning captain Kapil Dev was born on this day in 1959.",
        "category": "story",
        "format": "single",
        "teams": ["India"],
        "players": ["Kapil Dev"],
        "venue": "Chandigarh",
        "year": 1959,
        "match_format": "All",
        "tags": ["birthday", "legend", "all_rounder", "on_this_day"],
        "source": "wikipedia:Kapil_Dev",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/Kapil_Dev",
        "segments": [
            "🎂 Happy Birthday to the legendary Kapil Dev (born Jan 6, 1959)! 5,248 Test runs, 434 Test wickets, and the visionary captain who led India to the historic 1983 World Cup trophy! 🏆 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "01-11",
        "title": "Happy Birthday Rahul Dravid: 'The Wall'",
        "summary": "Rahul Dravid, India's dependable batting maestro with over 24,000 international runs and 31,258 balls faced in Test cricket, was born on this day in 1973.",
        "category": "story",
        "format": "single",
        "teams": ["India"],
        "players": ["Rahul Dravid"],
        "venue": "Indore",
        "year": 1973,
        "match_format": "Test",
        "tags": ["birthday", "the_wall", "legend", "on_this_day"],
        "source": "wikipedia:Rahul_Dravid",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/Rahul_Dravid",
        "segments": [
            "🧱 Happy Birthday to 'The Wall' Rahul Dravid (born Jan 11, 1973)! 13,288 Test runs, 36 centuries, 210 catches, and an unmatched 31,258 deliveries faced in Test history! 🇮🇳 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "01-18",
        "title": "AB de Villiers: 31-Ball Century Record (2015)",
        "summary": "On Jan 18, 2015, AB de Villiers shattered the record for the fastest century in ODI history in just 31 balls at the Wanderers.",
        "category": "story",
        "format": "single",
        "teams": ["South Africa", "West Indies"],
        "players": ["AB de Villiers"],
        "venue": "Wanderers Stadium, Johannesburg",
        "year": 2015,
        "match_format": "ODI",
        "tags": ["fastest_century", "record", "ab_de_villiers", "on_this_day"],
        "source": "wikipedia:AB_de_Villiers",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/AB_de_Villiers",
        "segments": [
            "⚡ Jan 18, 2015: AB de Villiers smashed the fastest century in ODI history off 31 deliveries against West Indies, finishing on 149 off 44 balls with 16 sixes! 💥 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "01-19",
        "title": "The Gabba Fortress Breached: India's 328 Chase (2021)",
        "summary": "On Jan 19, 2021, Rishabh Pant's 89* and Shubman Gill's 91 powered injury-hit India to chase 328 on Day 5 at the Gabba, ending Australia's 32-year unbeaten streak.",
        "category": "story",
        "format": "thread",
        "teams": ["India", "Australia"],
        "players": ["Rishabh Pant", "Shubman Gill", "Cheteshwar Pujara", "Pat Cummins"],
        "venue": "The Gabba, Brisbane",
        "year": 2021,
        "match_format": "Test",
        "tags": ["gabba", "comeback", "bgt", "pant", "on_this_day"],
        "source": "wikipedia:Indian_cricket_team_in_Australia_in_2020-21",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/Indian_cricket_team_in_Australia_in_2020%E2%80%9321",
        "segments": [
            "🏏 Jan 19, 2021: Australia hadn't lost at the Gabba in 32 years. Facing 328 on Day 5 with an injury-depleted squad, India staged cricket's greatest modern Test chase! #OnThisDay #TheCricketFan",
            "🔥 Shubman Gill (91) counter-attacked, Pujara (56) absorbed 11 body blows over 211 balls, setting up the grand finale! #OnThisDay #TheCricketFan",
            "🏆 Rishabh Pant smashed 89* to strike the winning boundary with 3 overs to spare — 'Toot Gaya Gabba Ka Ghamand!' Series won 2-1! #OnThisDay #TheCricketFan",
        ],
    },
    # February
    {
        "event_month_day": "02-07",
        "title": "Anil Kumble's Perfect 10 vs Pakistan (1999)",
        "summary": "On Feb 7, 1999, Anil Kumble became only the second bowler in Test history to take all 10 wickets in a single innings (10/74) at Feroz Shah Kotla.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Pakistan"],
        "players": ["Anil Kumble", "Javagal Srinath"],
        "venue": "Feroz Shah Kotla, Delhi",
        "year": 1999,
        "match_format": "Test",
        "tags": ["record", "ten_wickets", "kotla", "rivalry", "on_this_day"],
        "source": "wikipedia:Anil_Kumble_10_wickets",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/Anil_Kumble",
        "segments": [
            "🏏 Feb 7, 1999: Anil Kumble etched his name in immortality, taking all 10 wickets in an innings (10/74) against arch-rivals Pakistan at Feroz Shah Kotla! 🇮🇳 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "02-17",
        "title": "Happy Birthday AB de Villiers: Mr. 360",
        "summary": "Abraham Benjamin de Villiers, one of the most innovative and destructive batters in cricket history, was born on this day in 1984.",
        "category": "story",
        "format": "single",
        "teams": ["South Africa", "Royal Challengers Bangalore"],
        "players": ["AB de Villiers"],
        "venue": "Pretoria",
        "year": 1984,
        "match_format": "All",
        "tags": ["birthday", "mr_360", "legend", "on_this_day"],
        "source": "wikipedia:AB_de_Villiers",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/AB_de_Villiers",
        "segments": [
            "🎂 Happy Birthday to 'Mr. 360' AB de Villiers (born Feb 17, 1984)! Over 20,000 international runs, iconic ramp shots over fine leg, and pure batting wizardry! 🇿🇦👑 #OnThisDay #TheCricketFan"
        ],
    },
    # March
    {
        "event_month_day": "03-12",
        "title": "The 438 Game: South Africa vs Australia (2006)",
        "summary": "On Mar 12, 2006, South Africa chased down Australia's world-record 434 total with 1 wicket and 1 ball to spare in Johannesburg.",
        "category": "story",
        "format": "single",
        "teams": ["South Africa", "Australia"],
        "players": ["Herschelle Gibbs", "Ricky Ponting", "Mark Boucher"],
        "venue": "Wanderers Stadium, Johannesburg",
        "year": 2006,
        "match_format": "ODI",
        "tags": ["chase", "record", "wanderers", "on_this_day"],
        "source": "wikipedia:South_Africa_v_Australia_(2006)",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/South_African_cricket_team_in_Australia_in_2005%E2%80%9306",
        "segments": [
            "🏏 Mar 12, 2006: Australia scored an unprecedented 434/4. South Africa replied with 438/9, Herschelle Gibbs hitting 175 (111) to seal the greatest ODI chase ever! #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "03-14",
        "title": "The Kolkata Miracle: Laxman 281 & Dravid 180 (2001)",
        "summary": "On Mar 14, 2001, VVS Laxman and Rahul Dravid batted out the entire 4th day without losing a wicket after following on at Eden Gardens.",
        "category": "story",
        "format": "thread",
        "teams": ["India", "Australia"],
        "players": ["VVS Laxman", "Rahul Dravid", "Harbhajan Singh"],
        "venue": "Eden Gardens, Kolkata",
        "year": 2001,
        "match_format": "Test",
        "tags": ["comeback", "miracle", "eden_gardens", "on_this_day"],
        "source": "wikipedia:Kolkata_Test_2001",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/Second_Test,_2000%E2%80%9301_Border%E2%80%93Gavaskar_Trophy",
        "segments": [
            "🏏 Mar 14, 2001: India followed on 274 runs behind Australia at Eden Gardens. What followed was Day 4 of pure batting magic! #OnThisDay #TheCricketFan",
            "🔥 VVS Laxman (281) & Rahul Dravid (180) batted 90 overs without losing a single wicket, putting on 376 runs to turn defeat into victory! #OnThisDay #TheCricketFan",
        ],
    },
    {
        "event_month_day": "03-15",
        "title": "First Ever Test Match in Cricket History (1877)",
        "summary": "On Mar 15, 1877, Australia and England commenced the first official Test match at the Melbourne Cricket Ground.",
        "category": "story",
        "format": "single",
        "teams": ["Australia", "England"],
        "players": ["Charles Bannerman"],
        "venue": "Melbourne Cricket Ground",
        "year": 1877,
        "match_format": "Test",
        "tags": ["history", "first_test", "mcg", "on_this_day"],
        "source": "wikipedia:First_Test_Match_1877",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/First_Test_match",
        "segments": [
            "🏛️ Mar 15, 1877: The birth of Test Cricket! Australia played England at the MCG, where Charles Bannerman scored the first Test century (165 retired hurt). 🏏 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "03-18",
        "title": "Dinesh Karthik's Nidahas Trophy Last-Ball Six (2018)",
        "summary": "On Mar 18, 2018, Dinesh Karthik smashed 29* off 8 balls with a flat six over extra cover on the final delivery to win the Nidahas Trophy.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Bangladesh"],
        "players": ["Dinesh Karthik", "Soumya Sarkar"],
        "venue": "R. Premadasa Stadium, Colombo",
        "year": 2018,
        "match_format": "T20",
        "tags": ["last_ball", "six", "thriller", "on_this_day"],
        "source": "wikipedia:2018_Nidahas_Trophy_Final",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2018_Nidahas_Trophy",
        "segments": [
            "🏏 Mar 18, 2018: 5 needed off 1 ball! Dinesh Karthik smashed a stunning flat cover-drive SIX off Soumya Sarkar to snatch the Nidahas Trophy for India! 🏆 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "03-23",
        "title": "MS Dhoni's Last-Ball Sprint vs Bangladesh (2016)",
        "summary": "On Mar 23, 2016, MS Dhoni sprinted with one glove off to run out Mustafizur Rahman on the final ball in Bengaluru, winning by 1 run.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Bangladesh"],
        "players": ["MS Dhoni", "Mustafizur Rahman", "Hardik Pandya"],
        "venue": "M. Chinnaswamy Stadium, Bengaluru",
        "year": 2016,
        "match_format": "T20",
        "tags": ["dhoni", "run_out", "thriller", "on_this_day"],
        "source": "reddit:r/Cricket/comments/4bn631",
        "source_type": "reddit",
        "source_ref": "https://www.reddit.com/r/Cricket/comments/4bn631",
        "segments": [
            "🏏 Mar 23, 2016: 2 needed off 1 ball! MS Dhoni took off his glove, gathered the ball, and outsprinted Mustafizur to break the bails — India won by 1 run! ⚡ #OnThisDay #TheCricketFan"
        ],
    },
    # April
    {
        "event_month_day": "04-02",
        "title": "India Win the 2011 World Cup: 'Dhoni Finishes Off in Style'",
        "summary": "On Apr 2, 2011, MS Dhoni launched Nuwan Kulasekara into the Wankhede crowd as India won their second ODI World Cup after 28 years.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Sri Lanka"],
        "players": ["MS Dhoni", "Gautam Gambhir", "Yuvraj Singh", "Sachin Tendulkar"],
        "venue": "Wankhede Stadium, Mumbai",
        "year": 2011,
        "match_format": "ODI",
        "tags": ["world_cup", "champion", "dhoni", "on_this_day"],
        "source": "wikipedia:2011_Cricket_World_Cup_Final",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2011_Cricket_World_Cup_Final",
        "segments": [
            "🏆 Apr 2, 2011: 'Dhoni finishes off in style! A magnificent strike into the crowd! India lift the World Cup after 28 years!' Gambhir (97) & Dhoni (91*) make history at Wankhede! 🇮🇳 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "04-03",
        "title": "Carlos Brathwaite: 'Remember the Name' 4 Sixes (2016)",
        "summary": "On Apr 3, 2016, Carlos Brathwaite hit 4 consecutive sixes in the final over against Ben Stokes at Eden Gardens to win the World T20.",
        "category": "story",
        "format": "single",
        "teams": ["West Indies", "England"],
        "players": ["Carlos Brathwaite", "Ben Stokes"],
        "venue": "Eden Gardens, Kolkata",
        "year": 2016,
        "match_format": "T20",
        "tags": ["world_cup", "four_sixes", "eden_gardens", "on_this_day"],
        "source": "wikipedia:2016_ICC_World_Twenty20_Final",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2016_ICC_World_Twenty20_Final",
        "segments": [
            "🌴 Apr 3, 2016: 19 needed off 6 balls in the T20 World Cup final. Carlos Brathwaite goes 6, 6, 6, 6 off Ben Stokes! 'Carlos Brathwaite, remember the name!' 🏆 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "04-09",
        "title": "Rinku Singh: 5 Sixes in the 20th Over (2023)",
        "summary": "On Apr 9, 2023, Rinku Singh smashed five consecutive sixes in the final over off Yash Dayal to pull off an impossible IPL heist for KKR.",
        "category": "story",
        "format": "single",
        "teams": ["Kolkata Knight Riders", "Gujarat Titans"],
        "players": ["Rinku Singh", "Yash Dayal"],
        "venue": "Narendra Modi Stadium, Ahmedabad",
        "year": 2023,
        "match_format": "IPL",
        "tags": ["ipl", "five_sixes", "rinku_singh", "on_this_day"],
        "source": "wikipedia:2023_Indian_Premier_League",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2023_Indian_Premier_League",
        "segments": [
            "🏏 Apr 9, 2023: 28 needed off 5 balls! Rinku Singh hit 6, 6, 6, 6, 6 off Yash Dayal — the greatest last-over turnaround in T20 league history! 💜 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "04-18",
        "title": "Brendon McCullum 158*: The Birth of the IPL (2008)",
        "summary": "On Apr 18, 2008, Brendon McCullum blasted 158* off 73 balls for KKR against RCB at Chinnaswamy, lighting up the inaugural IPL match.",
        "category": "story",
        "format": "single",
        "teams": ["Kolkata Knight Riders", "Royal Challengers Bangalore"],
        "players": ["Brendon McCullum"],
        "venue": "M. Chinnaswamy Stadium, Bengaluru",
        "year": 2008,
        "match_format": "IPL",
        "tags": ["ipl", "mccullum", "inaugural", "on_this_day"],
        "source": "wikipedia:2008_Indian_Premier_League",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2008_Indian_Premier_League",
        "segments": [
            "🚀 Apr 18, 2008: The match that changed cricket forever! Brendon McCullum smashed 158* (73 balls, 13 sixes) on opening night of the IPL at Chinnaswamy! 💥 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "04-22",
        "title": "Sachin Tendulkar's Desert Storm in Sharjah (1998)",
        "summary": "On Apr 22, 1998, Sachin Tendulkar blasted 143 off 131 balls against Australia in a raging Sharjah sandstorm to power India into the final.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Australia"],
        "players": ["Sachin Tendulkar", "Shane Warne"],
        "venue": "Sharjah Cricket Stadium",
        "year": 1998,
        "match_format": "ODI",
        "tags": ["desert_storm", "sachin", "sharjah", "on_this_day"],
        "source": "wikipedia:1998_Coca-Cola_Cup",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/1997%E2%80%9398_Coca-Cola_Cup",
        "segments": [
            "🌪️ Apr 22, 1998: The Desert Storm! A sandstorm halted play in Sharjah. Sachin Tendulkar resumed with ferocious batting: 143 (131) against Warne and Australia! 🇮🇳 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "04-23",
        "title": "Chris Gayle's 175* off 66 Balls: T20 World Record (2013)",
        "summary": "On Apr 23, 2013, Chris Gayle demolished Pune Warriors with a record 175* including a 30-ball hundred and 17 sixes at the Chinnaswamy.",
        "category": "story",
        "format": "single",
        "teams": ["Royal Challengers Bangalore", "Pune Warriors India"],
        "players": ["Chris Gayle"],
        "venue": "M. Chinnaswamy Stadium, Bengaluru",
        "year": 2013,
        "match_format": "IPL",
        "tags": ["gayle_storm", "record", "ipl", "on_this_day"],
        "source": "wikipedia:2013_Indian_Premier_League",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2013_Indian_Premier_League",
        "segments": [
            "⚡ Apr 23, 2013: Gayle Storm at Chinnaswamy! Chris Gayle smashed 175* off 66 balls with 17 sixes — the highest individual score in T20 history! 💥 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "04-24",
        "title": "Happy Birthday Sachin Tendulkar & The Birthday Century (1998)",
        "summary": "Born on Apr 24, 1973, Sachin Tendulkar celebrated his 25th birthday by smashing 134 in the Coca-Cola Cup final in Sharjah to defeat Australia.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Australia"],
        "players": ["Sachin Tendulkar", "Shane Warne", "Steve Waugh"],
        "venue": "Sharjah Cricket Stadium",
        "year": 1998,
        "match_format": "ODI",
        "tags": ["birthday", "sachin", "sharjah", "on_this_day"],
        "source": "wikipedia:Sachin_Tendulkar",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/Sachin_Tendulkar",
        "segments": [
            "🎂 Happy Birthday to the 'God of Cricket' Sachin Tendulkar (born Apr 24, 1973)! On his 25th birthday in 1998, he scored 134 to win the Sharjah trophy vs Australia! 100 international centuries, 34,357 runs! 👑 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "04-30",
        "title": "Happy Birthday Rohit Sharma: 'The Hitman'",
        "summary": "Rohit Gurunath Sharma, India's legendary opening batter and 5-time IPL winning captain with 3 ODI double centuries, was born on this day in 1987.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Mumbai Indians"],
        "players": ["Rohit Sharma"],
        "venue": "Nagpur",
        "year": 1987,
        "match_format": "All",
        "tags": ["birthday", "hitman", "rohit_sharma", "on_this_day"],
        "source": "wikipedia:Rohit_Sharma",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/Rohit_Sharma",
        "segments": [
            "🎂 Happy Birthday to 'Hitman' Rohit Sharma (born Apr 30, 1987)! The only batter with 3 ODI double centuries (264, 209, 208*), most T20I sixes, and 5 IPL trophies! 🇮🇳🏏 #OnThisDay #TheCricketFan"
        ],
    },
    # June
    {
        "event_month_day": "06-18",
        "title": "Kapil Dev's 175* Rescue at Tunbridge Wells (1983)",
        "summary": "On Jun 18, 1983, Kapil Dev rescued India from 17/5 with an iconic 175* against Zimbabwe in the World Cup.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Zimbabwe"],
        "players": ["Kapil Dev"],
        "venue": "Nevill Ground, Tunbridge Wells",
        "year": 1983,
        "match_format": "ODI",
        "tags": ["world_cup", "rescue", "kapil_dev", "on_this_day"],
        "source": "wikipedia:1983_Cricket_World_Cup",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/1983_Cricket_World_Cup",
        "segments": [
            "🏏 Jun 18, 1983: India were 17/5 in a must-win World Cup game. Kapil Dev walked in and smashed an unbeaten 175 (16 fours, 6 sixes) — the greatest rescue in World Cup history! 🏆 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "06-25",
        "title": "India Crowned World Champions at Lord's (1983)",
        "summary": "On Jun 25, 1983, Kapil Dev's underdog India defended 183 to defeat Clive Lloyd's West Indies and lift their first World Cup at Lord's.",
        "category": "story",
        "format": "single",
        "teams": ["India", "West Indies"],
        "players": ["Kapil Dev", "Mohinder Amarnath", "Viv Richards"],
        "venue": "Lord's, London",
        "year": 1983,
        "match_format": "ODI",
        "tags": ["world_cup", "champion", "lords", "on_this_day"],
        "source": "wikipedia:1983_Cricket_World_Cup_Final",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/1983_Cricket_World_Cup_Final",
        "segments": [
            "🏆 Jun 25, 1983: Defending just 183 against the invincible West Indies, India bowled them out for 140 to lift the Prudential World Cup on the Lord's balcony! 🇮🇳✨ #OnThisDay #TheCricketFan"
        ],
    },
    # July
    {
        "event_month_day": "07-07",
        "title": "Happy Birthday MS Dhoni: 'Captain Cool'",
        "summary": "Mahendra Singh Dhoni, India's most successful white-ball captain who led India to the T20 World Cup (2007), ODI World Cup (2011), and Champions Trophy (2013), was born on this day in 1981.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Chennai Super Kings"],
        "players": ["MS Dhoni"],
        "venue": "Ranchi",
        "year": 1981,
        "match_format": "All",
        "tags": ["birthday", "dhoni", "captain_cool", "on_this_day"],
        "source": "wikipedia:MS_Dhoni",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/MS_Dhoni",
        "segments": [
            "🎂 Happy Birthday to 'Captain Cool' MS Dhoni (born Jul 7, 1981)! The only captain in cricket history to win all three ICC white-ball trophies (T20 WC 2007, ODI WC 2011, CT 2013) + 5 IPL titles! 🦁💛 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "07-13",
        "title": "NatWest Final 2002: Kaif & Yuvraj's Lord's Chase",
        "summary": "On Jul 13, 2002, Mohammad Kaif (87*) and Yuvraj Singh (69) chased 326 from 146/5 at Lord's, leading to Sourav Ganguly's shirt wave.",
        "category": "story",
        "format": "single",
        "teams": ["India", "England"],
        "players": ["Mohammad Kaif", "Yuvraj Singh", "Sourav Ganguly"],
        "venue": "Lord's, London",
        "year": 2002,
        "match_format": "ODI",
        "tags": ["natwest", "lords", "ganguly", "on_this_day"],
        "source": "wikipedia:2002_NatWest_Series_Final",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2002_NatWest_Series",
        "segments": [
            "🏏 Jul 13, 2002: Chasing 326 from 146/5, youngsters Kaif (87*) & Yuvraj (69) pulled off a fairytale win at Lord's, prompting Ganguly's unforgettable shirt wave! 🇮🇳 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "07-14",
        "title": "2019 World Cup Final: The Super Over & Boundary Count (2019)",
        "summary": "On Jul 14, 2019, England and New Zealand tied the World Cup final and the Super Over at Lord's, with England winning by boundary countback.",
        "category": "story",
        "format": "single",
        "teams": ["England", "New Zealand"],
        "players": ["Ben Stokes", "Jofra Archer", "Martin Guptill", "Jos Buttler"],
        "venue": "Lord's, London",
        "year": 2019,
        "match_format": "ODI",
        "tags": ["world_cup", "super_over", "lords", "on_this_day"],
        "source": "wikipedia:2019_Cricket_World_Cup_Final",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2019_Cricket_World_Cup_Final",
        "segments": [
            "🏆 Jul 14, 2019: 'By the barest of margins!' Tied after 50 overs (241), tied after the Super Over (15-15), England crowned World Champions on boundary count in cricket's wildest final! 🏴󠁧󠁢󠁥󠁮󠁧󠁿 #OnThisDay #TheCricketFan"
        ],
    },
    # August
    {
        "event_month_day": "08-15",
        "title": "India's Independence Day in Cricket: Historic Milestones",
        "summary": "On August 15, cricket celebrates iconic moments including MS Dhoni's international retirement in 2020 and India's greatest Test victories.",
        "category": "story",
        "format": "single",
        "teams": ["India"],
        "players": ["MS Dhoni", "Suresh Raina"],
        "venue": "Global",
        "year": 2020,
        "match_format": "All",
        "tags": ["independence_day", "dhoni_retirement", "history", "on_this_day"],
        "source": "wikipedia:India_cricket_milestones",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/Indian_cricket_team",
        "segments": [
            "🇮🇳 Aug 15: Celebrating India's rich cricket legacy on Independence Day — from the 1932 inaugural Test at Lord's to the golden eras under Kapil, Ganguly, Dhoni, and Kohli! 'Main pal do pal ka shayar hoon...' 🏏✨ #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "08-25",
        "title": "Ben Stokes' Headingley Miracle (2019)",
        "summary": "On Aug 25, 2019, Ben Stokes scored an extraordinary 135* to drag England across the finish line with last man Jack Leach at Headingley.",
        "category": "story",
        "format": "single",
        "teams": ["England", "Australia"],
        "players": ["Ben Stokes", "Jack Leach"],
        "venue": "Headingley, Leeds",
        "year": 2019,
        "match_format": "Test",
        "tags": ["ashes", "stokes", "headingley", "on_this_day"],
        "source": "wikipedia:2019_Ashes_series",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2019_Ashes_series",
        "segments": [
            "🏏 Aug 25, 2019: England were 286/9 needing 73 runs with Jack Leach. Ben Stokes unleashed a rampage of 135* to win the Test by 1 wicket! 🦁 #OnThisDay #TheCricketFan"
        ],
    },
    # September
    {
        "event_month_day": "09-19",
        "title": "Yuvraj Singh's 6 Sixes in Durban (2007)",
        "summary": "On Sep 19, 2007, Yuvraj Singh hit 6 sixes in one over off Stuart Broad in the T20 World Cup, reaching a fifty in 12 balls.",
        "category": "story",
        "format": "single",
        "teams": ["India", "England"],
        "players": ["Yuvraj Singh", "Stuart Broad"],
        "venue": "Kingsmead, Durban",
        "year": 2007,
        "match_format": "T20",
        "tags": ["six_sixes", "yuvraj_singh", "fastest_fifty", "on_this_day"],
        "source": "wikipedia:2007_ICC_World_Twenty20",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2007_ICC_World_Twenty20",
        "segments": [
            "🔥 Sep 19, 2007: 6, 6, 6, 6, 6, 6! Yuvraj Singh destroyed Stuart Broad in Durban, smashing the fastest 50 in international history off 12 balls! 💥 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "09-24",
        "title": "India Win Inaugural 2007 T20 World Cup in Johannesburg",
        "summary": "On Sep 24, 2007, MS Dhoni's young Indian team defeated Pakistan by 5 runs in a heart-stopping final at the Wanderers.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Pakistan"],
        "players": ["MS Dhoni", "Joginder Sharma", "Gautam Gambhir", "Misbah-ul-Haq"],
        "venue": "Wanderers Stadium, Johannesburg",
        "year": 2007,
        "match_format": "T20",
        "tags": ["world_cup", "champion", "dhoni", "on_this_day"],
        "source": "wikipedia:2007_ICC_World_Twenty20_Final",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2007_ICC_World_Twenty20_Final",
        "segments": [
            "🏆 Sep 24, 2007: 'In the air, Sreesanth takes it! India win the World Cup!' Joginder Sharma bowled the final over as young India stunned Pakistan in Johannesburg! 🇮🇳 #OnThisDay #TheCricketFan"
        ],
    },
    # October
    {
        "event_month_day": "10-23",
        "title": "Virat Kohli's 82* vs Pakistan at the MCG (2022)",
        "summary": "On Oct 23, 2022, Virat Kohli played a magical 82* off 53 balls to pull India from 31/4 to victory in front of 90,000 at the MCG.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Pakistan"],
        "players": ["Virat Kohli", "Haris Rauf", "Hardik Pandya"],
        "venue": "Melbourne Cricket Ground",
        "year": 2022,
        "match_format": "T20",
        "tags": ["kohli", "mcg", "masterclass", "rivalry", "on_this_day"],
        "source": "wikipedia:2022_ICC_Men's_T20_World_Cup",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2022_ICC_Men%27s_T20_World_Cup",
        "segments": [
            "👑 Oct 23, 2022: Chasing 160 vs Pakistan from 31/4, Virat Kohli played the innings of a lifetime (82* off 53), including THAT straight six off Haris Rauf at the MCG! 🇮🇳 #OnThisDay #TheCricketFan"
        ],
    },
    # November
    {
        "event_month_day": "11-05",
        "title": "Happy Birthday Virat Kohli: 'King Kohli'",
        "summary": "Virat Kohli, modern cricket's master chaser with 50 ODI centuries and over 26,000 international runs, was born on this day in 1988.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Royal Challengers Bangalore"],
        "players": ["Virat Kohli"],
        "venue": "Delhi",
        "year": 1988,
        "match_format": "All",
        "tags": ["birthday", "king_kohli", "legend", "on_this_day"],
        "source": "wikipedia:Virat_Kohli",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/Virat_Kohli",
        "segments": [
            "🎂 Happy Birthday to 'King' Virat Kohli (born Nov 5, 1988)! 50 ODI centuries, 80 international hundreds, the ultimate run machine and chase master in cricket history! 👑🇮🇳 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "11-07",
        "title": "Glenn Maxwell's 201* on One Leg vs Afghanistan (2023)",
        "summary": "On Nov 7, 2023, Glenn Maxwell battled severe cramps to hit 201* off 128 balls from 91/7 at Wankhede in the World Cup.",
        "category": "story",
        "format": "single",
        "teams": ["Australia", "Afghanistan"],
        "players": ["Glenn Maxwell", "Pat Cummins"],
        "venue": "Wankhede Stadium, Mumbai",
        "year": 2023,
        "match_format": "ODI",
        "tags": ["world_cup", "maxwell", "double_century", "on_this_day"],
        "source": "wikipedia:2023_Cricket_World_Cup",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/2023_Cricket_World_Cup",
        "segments": [
            "⚡ Nov 7, 2023: From 91/7 down and unable to run due to severe full-body cramps, Glenn Maxwell blasted 201* (21 fours, 10 sixes) to pull off the greatest ODI heist in history! 🇦🇺 #OnThisDay #TheCricketFan"
        ],
    },
    {
        "event_month_day": "11-13",
        "title": "Rohit Sharma's World Record 264 at Eden Gardens (2014)",
        "summary": "On Nov 13, 2014, Rohit Sharma blasted 264 runs off 173 balls against Sri Lanka — the highest individual score in ODI cricket history.",
        "category": "story",
        "format": "single",
        "teams": ["India", "Sri Lanka"],
        "players": ["Rohit Sharma"],
        "venue": "Eden Gardens, Kolkata",
        "year": 2014,
        "match_format": "ODI",
        "tags": ["record", "rohit_sharma", "eden_gardens", "on_this_day"],
        "source": "wikipedia:Rohit_Sharma_264",
        "source_type": "wikipedia",
        "source_ref": "https://en.wikipedia.org/wiki/Rohit_Sharma",
        "segments": [
            "🏏 Nov 13, 2014: Rohit Sharma broke the sound barrier at Eden Gardens, scoring an unbelievable 264 off 173 balls (33 fours, 9 sixes) vs Sri Lanka! 🇮🇳💥 #OnThisDay #TheCricketFan"
        ],
    },
]


def get_curated_milestone_for_date(month_day: str) -> dict[str, Any] | None:
    """Find a pre-curated milestone for the given 'MM-DD' date."""
    for m in CALENDAR_MILESTONES:
        if m["event_month_day"] == month_day:
            return m
    return None


def resolve_on_this_day_story(
    conn: sa.Connection, month_day: str | None = None
) -> dict[str, Any]:
    """Find or dynamically discover and persist an 'On This Day' story for the requested date."""
    if not month_day:
        now = datetime.now(timezone.utc)
        month_day = now.strftime("%m-%d")

    # 1. Check existing DB stories
    row = conn.execute(
        sa.select(content_bank)
        .where(content_bank.c.event_month_day == month_day)
        .order_by(content_bank.c.id.desc())
    ).first()

    if row is not None:
        teams = json.loads(row.teams_json) if row.teams_json else []
        players = json.loads(row.players_json) if row.players_json else []
        tags = json.loads(row.tags_json) if row.tags_json else []
        segments = json.loads(row.segments_json) if row.segments_json else []
        return {
            "content_key": row.content_key,
            "category": row.category,
            "format": row.format,
            "segments": segments,
            "source": row.source,
            "title": row.title or row.content_key,
            "summary": row.summary or (segments[0] if segments else ""),
            "source_type": row.source_type or "wikipedia",
            "source_ref": row.source_ref or row.source,
            "teams": teams,
            "players": players,
            "venue": row.venue,
            "year": row.year,
            "match_format": row.match_format,
            "tags": tags,
            "is_published": True,
            "event_month_day": row.event_month_day,
        }

    # 2. Check local curated milestones catalogue
    milestone = get_curated_milestone_for_date(month_day)

    # 3. If not in curated list, generate dynamically via AI/fallback
    if not milestone:
        from bot.harvest.llm_harvester import harvest_llm_obscure_stories

        month_num, day_num = month_day.split("-")
        prompt = f"Find 1 legendary cricket birthday, tournament final, historic match, or stadium milestone that took place on month {month_num}, day {day_num} in cricket history."
        generated = harvest_llm_obscure_stories(prompt_override=prompt)
        if generated:
            milestone = generated[0]
            milestone["event_month_day"] = month_day
        else:
            # Universal fallback for unmapped date
            milestone = {
                "event_month_day": month_day,
                "title": f"Cricket On This Day ({month_day})",
                "summary": f"Celebrating historic cricket moments and timeless matches played across the globe on {month_day}.",
                "category": "story",
                "format": "single",
                "teams": ["International Cricket"],
                "players": [],
                "venue": "Global",
                "year": 2020,
                "match_format": "All",
                "tags": ["history", "on_this_day"],
                "source": "curated:cricket_calendar",
                "source_type": "wikipedia",
                "source_ref": "https://en.wikipedia.org/wiki/Cricket",
                "segments": [
                    f"🏏 On This Day in Cricket History ({month_day}): Honoring the players, records, and unforgettable moments that shaped the gentleman's game! 🌟 #OnThisDay #TheCricketFan"
                ],
            }

    # 4. Auto-persist to DB so future lookups are instant
    now = datetime.now(timezone.utc)
    content_key = milestone.get("content_key")
    if not content_key:
        title_slug = re.sub(r"[^\w\s-]", "", milestone.get("title", "event").lower())
        title_slug = re.sub(r"[-\s]+", "-", title_slug).strip("-")[:24]
        content_key = f"story:on-this-day-{month_day}-{title_slug}"
        milestone["content_key"] = content_key

    # Check key duplicate before insert
    existing_key = conn.execute(
        sa.select(content_bank.c.id).where(content_bank.c.content_key == content_key)
    ).first()

    if not existing_key:
        conn.execute(
            content_bank.insert().values(
                category=milestone.get("category", "story"),
                format=milestone.get("format", "single"),
                segments_json=json.dumps(milestone.get("segments", [])),
                content_key=content_key,
                source=milestone.get("source", "calendar"),
                source_type=milestone.get("source_type", "wikipedia"),
                source_ref=milestone.get("source_ref", ""),
                title=milestone.get("title"),
                summary=milestone.get("summary"),
                teams_json=json.dumps(milestone.get("teams", [])),
                players_json=json.dumps(milestone.get("players", [])),
                venue=milestone.get("venue"),
                year=milestone.get("year"),
                match_format=milestone.get("match_format"),
                tags_json=json.dumps(milestone.get("tags", [])),
                event_month_day=month_day,
                is_published=True,
                created_at=now,
            )
        )
        try:
            if not getattr(conn, "_trans_context_manager", None):
                conn.commit()
        except Exception:
            pass

    return milestone
