"""Seed realistic likes and comments on public projects."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.models import ProjectLike, ProjectComment

engine = create_engine(
    'postgresql://postgres.ilijgndxhamiqtuabaoz:PRhjnJKVC89j2k5v@aws-1-us-east-2.pooler.supabase.com:6543/postgres'
)

# user_id → username for reference
USERS = {1:'brewmaster', 2:'skylershin', 3:'lil.beanbeannn', 4:'soi.boiii',
         6:'mayabrews', 7:'fermentfelix', 8:'lactolisamakes', 9:'meadmarco',
         10:'sodawitchcraft', 11:'wendywines'}

# (project_id, owner_id, type)
PROJECTS = [
    (12,  2, 'lacto'),   # Beets
    (14,  2, 'lacto'),   # Pickled Red Onions
    (18,  2, 'beer'),    # California Ale
    (22,  6, 'kombucha'),# Blueberry Lavender Kombucha
    (23,  6, 'kombucha'),# Jun Tea
    (24,  7, 'beer'),    # Hefeweizen
    (25,  7, 'beer'),    # Munich Dunkel
    (26,  8, 'kimchi'),  # Kkakdugi
    (27,  8, 'lacto'),   # Garlic Dill Pickles
    (28,  8, 'kefir'),   # Water Kefir Mango Passion
    (29,  9, 'mead'),    # Traditional Wildflower Mead
    (30,  9, 'cider'),   # Cyser Honey Apple
    (31, 10, 'kefir'),   # Raspberry Rose Water Kefir
    (32, 10, 'soda'),    # Hibiscus Ginger Probiotic Soda
    (33, 11, 'wine'),    # Elderflower White Wine
    (34, 11, 'wine'),    # Blackberry Country Wine
]

# likes[project_id] = [user_ids who liked it] (no self-likes)
LIKES = {
    12:  [1, 3, 7, 9, 10],
    14:  [1, 3, 4, 6, 7, 9, 10, 11],
    18:  [1, 3, 6, 7, 9, 11],
    22:  [1, 2, 3, 4, 9, 11],
    23:  [2, 3, 4, 9, 11],
    24:  [1, 2, 3, 4, 8, 9, 10, 11],
    25:  [2, 3, 4, 8, 9, 10],
    26:  [1, 2, 3, 4, 6, 7, 9, 10, 11],
    27:  [1, 2, 3, 4, 6, 7, 9],
    28:  [1, 2, 4, 6, 7, 9, 11],
    29:  [1, 2, 3, 4, 6, 7, 8, 10, 11],
    30:  [1, 2, 3, 4, 6, 7, 8],
    31:  [1, 2, 4, 6, 7, 9, 11],
    32:  [1, 2, 3, 4, 6, 7, 9, 11],
    33:  [1, 2, 3, 4, 6, 7, 8, 9, 10],
    34:  [1, 2, 3, 4, 7, 8, 9, 10],
}

# comments: (project_id, user_id, content, days_ago)
COMMENTS = [
    # Beets (12)
    (12,  7, "the color on this is incredible — almost neon! how long did you lacto for?", 18),
    (12,  9, "beet kvass territory! love seeing classic lacto on here", 15),
    (12,  3, "do you add any spices to your brine or straight salt water?", 10),
    (12,  2, "just 2% salt brine, nothing else — the beet flavor really shines through", 9),
    # Pickled Red Onions (14)
    (14,  3, "I've been looking for a good pickled onion recipe, what's your brine ratio?", 22),
    (14,  6, "those colors are gorgeous! did you add anything for the pink or is that natural?", 20),
    (14,  2, "100% natural from the onion pigment reacting with the acid. magic every time 🌸", 19),
    (14,  9, "going on my tacos ASAP. how long until they're ready to eat?", 14),
    (14, 11, "put these on grain bowls and it's genuinely life changing", 8),
    (14,  4, "the color progression photos are so satisfying", 5),
    # California Ale (18)
    (18,  1, "US-05 is such a reliable workhorse. what hop schedule are you running?", 12),
    (18,  7, "nice OG! are you doing any dry hopping?", 10),
    (18,  9, "I love a simple clean ale. sometimes less is more with American styles", 7),
    (18, 11, "keep us posted on final gravity — curious how far it'll drop", 4),
    # Blueberry Lavender Kombucha (22)
    (22,  2, "the blueberry + lavender combo is SO smart. what ratio did you use?", 9),
    (22,  3, "second ferment magic ✨ how carbonated did it get?", 7),
    (22,  4, "lavender can get soapy fast — did you find the right amount on first try?", 5),
    (22,  9, "this sounds incredibly refreshing. saving this for summer", 3),
    # Jun Tea (23)
    (23,  2, "jun is so underrated. the honey gives it such a different character than regular kombucha", 11),
    (23,  4, "I've been wanting to try jun forever. is the SCOBY hard to source?", 8),
    (23,  9, "green tea + honey is such a delicate combo. beautiful ferment", 4),
    # Hefeweizen (24)
    (24,  1, "WB-06 throws such a clean banana/clove profile at the right temps. what ferm temp are you at?", 14),
    (24,  2, "classic hefe! do you do a decoction mash or infusion?", 11),
    (24,  8, "a good hefe in summer is unbeatable. looks like a great batch", 6),
    (24, 10, "love the cloudiness on this — true to style!", 3),
    # Munich Dunkel (25)
    (25,  1, "Dunkel is so underappreciated. that malt character should be incredible", 8),
    (25,  2, "the color on that looks exactly right. Munich malt forward?", 6),
    (25,  4, "dark lagers are having a moment and for good reason. nice work", 3),
    # Kkakdugi (26)
    (26,  2, "I've only made napa kimchi before — does radish ferment faster?", 16),
    (26,  3, "kkakdugi is my FAVORITE. the crunch is unbeatable when fresh", 14),
    (26,  4, "what's your gochugaru to radish ratio?", 10),
    (26,  8, "ferments faster than napa and the texture stays crisp way longer", 9),
    (26,  6, "love seeing kimchi varieties! I should branch out from baechu", 5),
    (26,  9, "this with rice and a fried egg is the perfect meal", 2),
    # Garlic Dill Pickles (27)
    (27,  2, "lacto pickles over vinegar any day. how many days until you're eating them?", 13),
    (27,  3, "the garlic gets so mellow and savory after fermentation. yum", 9),
    (27,  6, "I add a grape leaf for tannins to keep them crispy — do you do anything like that?", 6),
    (27,  9, "dill + lacto is a classic for a reason. can't wait to see the day 7 update", 3),
    # Water Kefir (28)
    (28,  2, "mango passion second ferment sounds incredible! how much fruit did you add?", 7),
    (28,  6, "water kefir is so versatile. I love that you're doing tropical flavors", 5),
    (28, 11, "the carbonation on water kefir second ferments is always insane", 2),
    # Traditional Wildflower Mead (29)
    (29,  1, "what yeast did you use? some meads can stall if nutrient additions aren't timed right", 21),
    (29,  2, "wildflower honey meads have so much complexity. can't wait to see how this clears", 18),
    (29,  6, "patience is everything with mead. this is going to be beautiful in 6 months", 12),
    (29,  7, "are you doing TOSNA or Lallemand protocol for nutrients?", 8),
    (29, 10, "mead is my white whale. yours looks so clean though!", 4),
    # Cyser (30)
    (30,  2, "cyser is such a brilliant combo. apple + honey is autumn in a bottle", 15),
    (30,  6, "what apple juice are you using? fresh pressed makes such a difference", 10),
    (30,  7, "OG on this must be high! what are you targeting for final ABV?", 6),
    (30, 11, "I made a cyser last fall and it was gone by Christmas. yours looks great", 3),
    # Raspberry Rose Water Kefir (31)
    (31,  2, "raspberry rose is such a beautiful pairing! did you use rosewater or petals?", 8),
    (31,  6, "water kefir second ferments are so fun. this flavor combo sounds dreamy", 5),
    (31,  9, "the color on this must be stunning. pink lemonade vibes", 3),
    # Hibiscus Ginger Probiotic Soda (32)
    (32,  2, "hibiscus ginger is a killer combo. how spicy does the ginger come through?", 10),
    (32,  3, "this sounds like the most refreshing thing ever. love probiotic sodas", 7),
    (32,  6, "I've been wanting to get into water kefir sodas. what's your starter grain ratio?", 4),
    (32,  9, "the tartness from hibiscus + the heat from ginger 🤌 brilliant", 2),
    # Elderflower White Wine (33)
    (33,  1, "elderflower wine is such an underrated style. light and floral — gorgeous in summer", 19),
    (33,  2, "this sounds incredible! did you use fresh or dried flowers?", 16),
    (33,  4, "country wines are so underappreciated. can't wait to see the FG reading", 11),
    (33,  8, "floral wines age so beautifully. how long are you planning to bulk age?", 6),
    (33,  9, "this and a cheese board sounds like the perfect evening", 3),
    # Blackberry Country Wine (34)
    (34,  1, "blackberry wine is one of my favorites to make. what's your sugar target?", 14),
    (34,  2, "country wines are so satisfying. the color must be incredible", 11),
    (34,  3, "do you add any tannins or pectic enzyme?", 8),
    (34,  8, "pectic enzyme is key for clearing blackberry — gorgeous ferment", 7),
    (34,  9, "I'd love to see this in 6 months once it clears and ages a bit", 3),
]

def run():
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    added_likes = 0
    added_comments = 0

    try:
        # Likes
        existing_likes = set(
            (r[0], r[1]) for r in db.execute(text('SELECT project_id, user_id FROM project_likes'))
        )
        for pid, likers in LIKES.items():
            for uid in likers:
                if (pid, uid) not in existing_likes:
                    days_ago = (pid + uid) % 20 + 1  # pseudo-random spread
                    created = now - timedelta(days=days_ago, hours=uid % 12)
                    db.add(ProjectLike(project_id=pid, user_id=uid, created_at=created))
                    added_likes += 1

        db.flush()

        # Comments
        existing_snippets = set(
            r[0] for r in db.execute(text('SELECT LEFT(content, 30) FROM project_comments'))
        )
        for pid, uid, content, days_ago in COMMENTS:
            snippet = content[:30]
            if snippet not in existing_snippets:
                created = now - timedelta(days=days_ago, hours=uid % 8)
                db.add(ProjectComment(
                    project_id=pid,
                    user_id=uid,
                    content=content,
                    created_at=created,
                    parent_id=None,
                ))
                existing_snippets.add(snippet)
                added_comments += 1

        db.commit()
        print(f"Added {added_likes} likes and {added_comments} comments.")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == '__main__':
    run()
