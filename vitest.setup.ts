import { configure } from "@testing-library/dom";

// findBy… / waitFor give up after 1 s by default: too short when every test
// file runs in parallel on a busy machine. Real failures still fail, later.
configure({ asyncUtilTimeout: 5000 });
