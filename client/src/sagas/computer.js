import {
  all,
  call,
  delay,
  put,
  race,
  select,
  take,
} from "@redux-saga/core/effects";
import AlphaBetaConstructor from "alphabeta";
import { path, prop } from "ramda";
import actions from "../actions";
import { PlayerType } from "../constants";
import * as selectors from "../selectors";

const scoreFunction = (state, callback) => {
  let score = 0;
  for (const consecutive of selectors.consecutives(state)) {
    const player = path(consecutive[0], state.columns);
    if (player === state.current) {
      score += consecutive.length ** consecutive.length;
    }
  }
  return callback(-score);
};

const columnIndexes = [3, 4, 2, 5, 1, 6, 0];

const generateMoves = (state) => {
  const successors = [];
  const nextPlayer = selectors.oppositePlayer(state.currentPlayer);
  for (const columnIndex of columnIndexes) {
    if (selectors.isColumnNotFull(columnIndex, state)) {
      const successor = JSON.parse(JSON.stringify(state));
      successor.columns[columnIndex].push(state.currentPlayer);
      successor.currentPlayer = nextPlayer;
      successor.columnIndex = columnIndex;
      successors.push(successor);
    }
  }
  return successors;
};

const checkWinConditions = selectors.isWin;

const alphabeta = AlphaBetaConstructor({
  scoreFunction,
  generateMoves,
  checkWinConditions,
  uniqueKey: JSON.stringify,
});

function* computerDropDisc() {
  const columns = yield select(selectors.columns);
  const currentPlayer = yield select(selectors.currentPlayer);
  const opponentType = yield select(selectors.opponentType);
  const alphabetaConfig = {
    state: {
      columns,
      currentPlayer,
      columnIndex: undefined,
    },
    depth: prop(opponentType, {
      [PlayerType.EasyComputer]: 3,
      [PlayerType.MediumComputer]: 4,
      [PlayerType.HardComputer]: 5,
    }),
  };
  alphabeta.setup(alphabetaConfig);
  const [bestState] = yield all([
    call(() => new Promise((resolve) => alphabeta.allSteps(resolve))),
    delay(1000 / 4),
  ]);
  yield put(actions.dropDisc(opponentType, bestState.columnIndex));
}

function* blockUntil(predicate) {
  while (true) {
    yield take("*");
    if (yield select(predicate)) {
      break;
    }
  }
}

function* computerSaga() {
  while (true) {
    yield* blockUntil(selectors.isTurnComputer);
    yield race([call(computerDropDisc), take("RESTART_GAME")]);
  }
}

export default computerSaga;
