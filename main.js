import express from "npm:express@4.18.2"

const app = express();
const router = express.Router();

const __dirname = Deno.realPathSync(Deno.cwd());

const root =
  Deno.env.get("NODE_ENV") === "production"
    ? Deno.realPathSync(__dirname + "/..")
    : __dirname;

app.use(express.json());
app.use("/static", express.static(Deno.realPathSync(Deno.cwd() + "/static")));

app.get("/", (_req, res) => {
  return res.sendFile("static/index.html", { root });
});

app.use("/api/v1/", router);

router.get("/docs", (_req, res) => {
  return res.sendFile("static/ekswagger-tarot-api-1.3-resolved.json", { root });
});

router.use((_req, res, next) => {
  res.locals.rawData = JSON.parse(
    Deno.readTextFileSync("static/card_data.json")
  );
  return next();
});

router.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin,X-Requested-With,Content-Type,Accept,content-type,application/json"
  );
  return next();
});

router.get("/", (_req, res) => {
  return res.redirect("/api/v1/cards");
});

router.get("/cards", (_req, res) => {
  const { cards } = res.locals.rawData;
  return res.json({ nhits: cards.length, cards });
});

router.get("/cards/search", (req, res) => {
  const { cards } = res.locals.rawData;
  console.log(`req.query:`, req.query);

  // Check for empty query and redirect if necessary
  if (!req.query || Object.keys(req.query).length === 0) {
    return res.redirect("/api/v1/cards");
  }

  // Function to determine if a card matches all the query parameters
  const matchesAllQueries = (card) => {
    return Object.keys(req.query).every((key) => {
      const value = req.query[key].toLowerCase();
      if (key === "meaning") {
        return [card.meaning_up, card.meaning_rev].join().toLowerCase().includes(value);
      } else if (key === "q") {
        return Object.values(card).join().toLowerCase().includes(value);
      } else {
        return card[key] && card[key].toString().toLowerCase() === value;
      }
    });
  };

  // Filter the cards using the matchesAllQueries function
  const filteredCards = cards.filter(matchesAllQueries);

  // Return the JSON response with filtered cards
  return res.json({ nhits: filteredCards.length, cards: filteredCards });
});

router.get("/cards/random", (req, res) => {
  const { cards } = res.locals.rawData;
  const numberOfCardsToSelect = req.query.n > 0 && req.query.n < 79 ? parseInt(req.query.n) : 78;

  // Fisher-Yates shuffle algorithm
  const shuffleArray = (array) => {
    let currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (currentIndex !== 0) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }
  const shuffledCards = shuffleArray(structuredClone(cards));
  const returnCards = shuffledCards.slice(0, numberOfCardsToSelect);
  return res.json({ nhits: returnCards.length, cards: returnCards });
});

router.get("/cards/:id", (req, res, next) => {
  const { cards } = res.locals.rawData;
  const card = cards.find((c) => c.name_short === req.params.id);
  if (typeof card === "undefined") return next();
  return res.json({ nhits: 1, card });
});

router.get("/cards/suits/:suit", (req, res, next) => {
  const { cards } = res.locals.rawData;
  const cardsOfSuit = cards.filter((c) => c.suit === req.params.suit);
  if (!cardsOfSuit.length) return next();
  return res
    .json({ nhits: cardsOfSuit.length, cards: cardsOfSuit })
    ;
});

router.get("/cards/courts", (_req, res) => {
  const { cards } = res.locals.rawData;
  const courtCards = cards.filter((c) =>
    ["queen", "king", "page", "knight"].includes(c.value)
  );
  return res.json({ nhits: courtCards.length, cards: courtCards });
});

router.get("/cards/courts/:court", (req, res, next) => {
  const { cards } = res.locals.rawData;
  const { court } = req.params;
  const len = court.length;
  if (len < 4) return next();
  const courtSg = court[len - 1] === "s" ? court.slice(0, len - 1) : court;
  const cardsOfCourt = cards.filter((c) => c.value === courtSg);
  if (!cardsOfCourt.length) return next();
  return res
    .json({ nhits: cardsOfCourt.length, cards: cardsOfCourt })
    ;
});

router.use((_req, _res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

router.use((err, _req, res) => {
  res.status(err.status || 500);
  res.json({ error: { status: err.status, message: err.message } });
});

const port = Deno.env.get("PORT") || 8000;

app.listen(port, () => {
  console.log("RWS API Server now running on port", port);
});
