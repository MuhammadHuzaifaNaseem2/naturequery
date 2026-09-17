-- Cricket Database for PostgreSQL
-- Run this in pgAdmin after creating 'cricket' database

-- Team Table
CREATE TABLE Team (
    TeamID INT PRIMARY KEY,
    TeamCountry VARCHAR(50),
    TeamName VARCHAR(50),
    TeamCaption VARCHAR(50),
    TeamCoach VARCHAR(50)
);

-- Players Table
CREATE TABLE Players (
    PlayerID INT PRIMARY KEY,
    PlayerName VARCHAR(50),
    PlayerNationality VARCHAR(50),
    PlayerAge INT,
    PlayerRole VARCHAR(50),
    TeamID INT REFERENCES Team(TeamID)
);

-- Matches Table
CREATE TABLE Matches (
    MatchID INT PRIMARY KEY,
    MatchDate DATE,
    MatchType VARCHAR(50),
    MatchResult VARCHAR(50)
);

-- MatchDetails Table
CREATE TABLE MatchDetails (
    MatchDetailID INT PRIMARY KEY,
    MatchID INT REFERENCES Matches(MatchID),
    TeamID INT REFERENCES Team(TeamID),
    RunsScoredM INT,
    WicketsLost INT
);

-- PlayerStats Table
CREATE TABLE PlayerStats (
    PlayerStatID INT PRIMARY KEY,
    PlayerID INT REFERENCES Players(PlayerID),
    MatchID INT REFERENCES Matches(MatchID),
    RunsScoredP INT,
    WicketsTaken INT
);

-- Tournaments Table
CREATE TABLE Tournaments (
    TournamentID INT PRIMARY KEY,
    TournamentName VARCHAR(50),
    TournamentStartDate DATE,
    TournamentEndDate DATE
);

-- MatchTournaments Table
CREATE TABLE MatchTournaments (
    MatchTournamentID INT PRIMARY KEY,
    MatchID INT REFERENCES Matches(MatchID),
    TournamentID INT REFERENCES Tournaments(TournamentID)
);

-- Insert Team Data
INSERT INTO Team VALUES
(1, 'India', 'Mumbai Indians', 'Rohit Sharma', 'Mahela Jayawardene'),
(2, 'Australia', 'Sydney Sixers', 'Moises Henriques', 'Greg Shipperd'),
(3, 'England', 'Manchester Originals', 'Jos Buttler', 'Gary Kirsten'),
(4, 'India', 'Chennai Super Kings', 'MS Dhoni', 'Stephen Fleming'),
(5, 'Pakistan', 'Lahore Qalandars', 'Shaheen Afridi', 'Aaqib Javed'),
(6, 'South Africa', 'Pretoria Capitals', 'Wayne Parnell', 'Graham Smith'),
(7, 'West Indies', 'Jamaica Tallawahs', 'Rovman Powell', 'Phil Simmons'),
(8, 'New Zealand', 'Auckland Aces', 'Tom Latham', 'Daniel Vettori'),
(9, 'Sri Lanka', 'Colombo Kings', 'Angelo Mathews', 'Mickey Arthur'),
(10, 'Bangladesh', 'Dhaka Dynamites', 'Shakib Al Hasan', 'Khaled Mahmud');

-- Insert Players Data
INSERT INTO Players VALUES
(1, 'Virat Kohli', 'India', 34, 'Batsman', 1),
(2, 'Steve Smith', 'Australia', 33, 'Batsman', 2),
(3, 'Ben Stokes', 'England', 32, 'All-Rounder', 3),
(4, 'Faf du Plessis', 'South Africa', 38, 'Batsman', 6),
(5, 'Shaheen Afridi', 'Pakistan', 24, 'Bowler', 5),
(6, 'Rashid Khan', 'Afghanistan', 25, 'Bowler', 4),
(7, 'Andre Russell', 'West Indies', 35, 'All-Rounder', 7),
(8, 'Trent Boult', 'New Zealand', 34, 'Bowler', 8),
(9, 'Lasith Malinga', 'Sri Lanka', 40, 'Bowler', 9),
(10, 'Tamim Iqbal', 'Bangladesh', 34, 'Batsman', 10),
(11, 'David Warner', 'Australia', 36, 'Batsman', 2),
(12, 'Eoin Morgan', 'England', 37, 'Batsman', 3),
(13, 'Jasprit Bumrah', 'India', 30, 'Bowler', 1),
(14, 'Babar Azam', 'Pakistan', 29, 'Batsman', 5),
(15, 'Chris Gayle', 'West Indies', 45, 'Batsman', 7),
(16, 'Kane Williamson', 'New Zealand', 33, 'Batsman', 8),
(17, 'Shakib Al Hasan', 'Bangladesh', 36, 'All-Rounder', 10),
(18, 'AB de Villiers', 'South Africa', 40, 'Batsman', 6),
(19, 'Muttiah Muralitharan', 'Sri Lanka', 51, 'Bowler', 9),
(20, 'Sunil Narine', 'West Indies', 35, 'Bowler', 7);

-- Insert Matches Data
INSERT INTO Matches VALUES
(1, '2024-01-01', 'ODI', 'India Won'),
(2, '2024-01-02', 'T20', 'Australia Won'),
(3, '2024-01-03', 'Test', 'England Won'),
(4, '2024-01-04', 'T20', 'India Won'),
(5, '2024-01-05', 'ODI', 'Pakistan Won'),
(6, '2024-01-06', 'Test', 'South Africa Won'),
(7, '2024-01-07', 'ODI', 'West Indies Won'),
(8, '2024-01-08', 'T20', 'New Zealand Won'),
(9, '2024-01-09', 'Test', 'Sri Lanka Won'),
(10, '2024-01-10', 'ODI', 'Bangladesh Won');

-- Insert MatchDetails Data
INSERT INTO MatchDetails VALUES
(1, 1, 1, 320, 6),
(2, 1, 5, 300, 8),
(3, 2, 2, 210, 5),
(4, 2, 6, 180, 7),
(5, 3, 3, 500, 10),
(6, 3, 9, 470, 8),
(7, 4, 1, 220, 3),
(8, 4, 7, 200, 6),
(9, 5, 5, 280, 4),
(10, 5, 8, 250, 8);

-- Insert PlayerStats Data
INSERT INTO PlayerStats VALUES
(1, 1, 1, 100, 0),
(2, 2, 2, 90, 0),
(3, 3, 3, 150, 1),
(4, 4, 4, 70, 0),
(5, 5, 5, 50, 3),
(6, 6, 6, 20, 4),
(7, 7, 7, 110, 0),
(8, 8, 8, 85, 0),
(9, 9, 9, 130, 2),
(10, 10, 10, 120, 1);

-- Insert Tournaments Data
INSERT INTO Tournaments VALUES
(1, 'World Cup', '2024-02-01', '2024-03-30'),
(2, 'T20 League', '2024-01-01', '2024-01-31'),
(3, 'ODI Championship', '2023-12-01', '2023-12-31'),
(4, 'Ashes Series', '2023-11-15', '2023-12-15'),
(5, 'Asia Cup', '2024-06-01', '2024-06-15'),
(6, 'Champions Trophy', '2024-05-01', '2024-05-15'),
(7, 'CPL', '2023-08-01', '2023-08-20'),
(8, 'IPL', '2024-04-01', '2024-05-30'),
(9, 'PSL', '2024-02-01', '2024-02-20'),
(10, 'Big Bash League', '2023-12-15', '2024-01-15');

-- Insert MatchTournaments Data
INSERT INTO MatchTournaments VALUES
(1, 1, 2),
(2, 2, 2),
(3, 3, 3),
(4, 4, 8),
(5, 5, 9),
(6, 6, 9),
(7, 7, 6),
(8, 8, 8),
(9, 9, 1),
(10, 10, 1);

SELECT 'Cricket database created with 7 tables!' AS result;
