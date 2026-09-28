#include "stl_support.h"
/***************************************************************************
 *   Copyright (C) 2012 by santiago González                               *
 *   santigoro@gmail.com                                                   *
 *                                                                         *
 *   This program is free software; you can redistribute it and/or modify  *
 *   it under the terms of the GNU General Public License as published by  *
 *   the Free Software Foundation; either version 3 of the License, or     *
 *   (at your option) any later version.                                   *
 *                                                                         *
 *   This program is distributed in the hope that it will be useful,       *
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of        *
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the         *
 *   GNU General Public License for more details.                          *
 *                                                                         *
 *   You should have received a copy of the GNU General Public License     *
 *   along with this program; if not, see <http://www.gnu.org/licenses/>.  *
 *                                                                         *
 ***************************************************************************/

#ifndef CIRCMATRIX_H
#define CIRCMATRIX_H

#include "e-node.h"

#include <vector>

class CircMatrix
{
    typedef std::vector<int> i_vector_t;
    typedef std::vector<double> d_vector_t;
    typedef std::vector<double *> dp_vector_t;
    typedef std::vector<std::vector<double>> d_matrix_t;
    typedef std::vector<std::vector<double *>> dp_matrix_t;

  public:
    CircMatrix(Simulator& sim);
    ~CircMatrix();



    void printMatrix();
    void createMatrix(std::vector<eNode *> &eNodeList);
    void stampMatrix(int row, int col, double value);
    void stampCoef(int row, double value);
    bool solveMatrix();

    void setCircChanged();

    d_matrix_t getMatrix()
    {
        return m_circMatrix;
    }
    d_vector_t getCoeffVect()
    {
        return m_coefVect;
    }

  private:
    Simulator* m_simulator;

    bool factorMatrix(int n, int group);
    bool luSolve(int n, int group);
    void addConnections(int enodNum, std::vector<int> *nodeGroup,
                        std::vector<int> *allNodes);

    int m_numEnodes;
    std::vector<eNode *> *m_eNodeList;

    std::vector<dp_matrix_t> m_aList;
    std::vector<d_matrix_t> m_aFaList;
    std::vector<dp_vector_t> m_bList;
    std::vector<i_vector_t> m_ipvtList;

    std::vector<eNode *> *m_eNodeActive;
    std::vector<std::vector<eNode *>> m_eNodeActList;

    d_matrix_t m_circMatrix;
    d_vector_t m_coefVect;

    bool m_admitChanged;
    bool m_circChanged;
    bool m_currChanged;
};
#endif
