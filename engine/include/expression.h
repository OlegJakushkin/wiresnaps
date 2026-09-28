// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <functional>
#include <string>
#include <vector>
namespace ws {
// A pure, bounded expression language. It has no objects, assignment, loops,
// property access, host functions, allocation instructions, or executable code.
class Expression {
    struct Node {std::string op;double number=0;std::vector<unsigned> args;};
    std::vector<Node> nodes_;
    unsigned root_=0;
public:
    explicit Expression(const std::string& text);
    double evaluate(const std::function<double(const std::string&)>& variable) const;
};
}
