#pragma once
#include <deque>
template<class T> T ws_take_front(std::deque<T>& queue) {
    auto result = queue.front(); queue.pop_front(); return result;
}
