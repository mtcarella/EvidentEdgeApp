/*
# Replace placeholder giveaway items with actual inventory list

Removes the placeholder seed data and inserts the real giveaway inventory
items as provided by the user.
*/

DELETE FROM giveaway_items;

INSERT INTO giveaway_items (item_name, current_quantity, unit) VALUES
  ('2026 Calendar Mouse Pads', 135, 'pieces'),
  ('Chapsticks', 250, 'pieces'),
  ('Hand Warmers', 150, 'pieces'),
  ('Napkins', 150, 'pieces'),
  ('White Out', 500, 'pieces'),
  ('Flower Pots', 68, 'pieces'),
  ('Wine Bags', 300, 'pieces'),
  ('Open House Pads', 85, 'pieces'),
  ('3x3 Post It Cubes', 128, 'pieces'),
  ('Black Stickers', 1500, 'pieces'),
  ('White Stickers', 1500, 'pieces'),
  ('4x6 Pads', 225, 'pieces'),
  ('Paddle Boards', 2, 'pieces'),
  ('Ice Scrapers', 3, 'pieces'),
  ('Hand Sanitizers', 360, 'pieces'),
  ('Tide Sticks', 225, 'pieces'),
  ('Mini Flash Lights', 100, 'pieces'),
  ('Tape Measures', 128, 'pieces'),
  ('Letter Openers', 400, 'pieces'),
  ('Holiday Ribbon', 2, 'rolls'),
  ('Picture Frames with Charger', 3, 'pieces'),
  ('Lint Rollers', 21, 'pieces'),
  ('Blank Evident Cards', 50, 'pieces'),
  ('Congratulations Cards', 100, 'pieces'),
  ('Happy Birthday Cards', 100, 'pieces'),
  ('Thinking of You Cards', 50, 'pieces'),
  ('Eyeglass Cleaner Cloths', 100, 'pieces'),
  ('Raffle Tickets', 2, 'rolls'),
  ('Mouse Pad w/ Charger', 14, 'pieces'),
  ('To-do Pads', 400, 'pieces'),
  ('Decanters', 23, 'pieces'),
  ('Ice Buckets', 6, 'pieces'),
  ('Large Votive Glass', 24, 'pieces'),
  ('Short Votive Glass', 24, 'pieces'),
  ('Candy Jars', 8, 'pieces'),
  ('Christmas Boxes', 5, 'pieces'),
  ('Pull Up Banners', 3, 'pieces'),
  ('Flag Banners', 2, 'pieces'),
  ('Step and Repeat', 1, 'pieces'),
  ('Table Cloths', 2, 'pieces');