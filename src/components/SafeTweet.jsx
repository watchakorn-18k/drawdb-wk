import { Component } from "react";
import { Tweet } from "react-tweet";

/**
 * react-tweet's <Tweet> throws (e.g. "entities is not iterable") when the
 * syndication API returns an incomplete payload for a deleted, unavailable, or
 * rate-limited tweet. Without a boundary that render error white-screens the
 * whole page, so isolate each tweet and drop it silently on failure.
 */
class TweetErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export default function SafeTweet({ id, fallback = null }) {
  return (
    <TweetErrorBoundary fallback={fallback}>
      <Tweet id={id} />
    </TweetErrorBoundary>
  );
}
