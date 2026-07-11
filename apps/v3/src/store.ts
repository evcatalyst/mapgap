import { applyMiddleware, combineReducers, createStore } from "redux";
import { enhanceReduxMiddleware, keplerGlReducer } from "@kepler.gl/reducers";

const reducer = combineReducers({
  keplerGl: keplerGlReducer,
});

/** Kepler Redux is V3 presentation state only; project data stays portable. */
export const v3Store = createStore(reducer, applyMiddleware(...enhanceReduxMiddleware()));

export type V3ReduxState = ReturnType<typeof reducer>;
