#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <functional>
#include <limits>
#include <map>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

class Simulator;
namespace ws {
template<class T, class U> bool contains(const std::vector<T>& v, const U& item) {
    return std::find(v.begin(), v.end(), item) != v.end();
}
inline bool contains(const std::string& v, const std::string& item) { return v.find(item) != std::string::npos; }
template<class T, class U> void remove_one(std::vector<T>& v, const U& item) {
    auto i = std::find(v.begin(), v.end(), item); if (i != v.end()) v.erase(i);
}
inline int suffix_number(const std::string& value, const std::string& prefix) {
    auto p = value.rfind(prefix);
    if (p == std::string::npos) throw std::invalid_argument("Unknown terminal name");
    return std::stoi(value.substr(p + prefix.size()));
}
}
