--!strict
-- HEADER BOMB: central tuning values. Shared by server and client.

local Config = {}

Config.GroupId = 33143184

-- Arena -------------------------------------------------------------------
Config.SquareSize = 24 -- studs per square (X and Z)
Config.ArenaOrigin = Vector3.new(0, 0, 0) -- centre of the arena turf surface
Config.TurfThickness = 1
Config.WallHeight = 14 -- invisible laser walls keep players inside their square
Config.MinPlayers = 2 -- humans + bots needed to start
Config.BotFillTo = 4 -- bots fill a 2x2 up to this many; 3x3 used when more humans join
Config.LargeGridThreshold = 5 -- 5+ participants -> 3x3

-- Match flow ----------------------------------------------------------------
Config.IntermissionTime = 15
Config.RoundMinTime = 30
Config.RoundMaxTime = 60
Config.PostRoundTime = 4
Config.PostMatchTime = 8

-- Ball ----------------------------------------------------------------------
Config.Gravity = 60 -- studs/s^2 used by the custom ball (not workspace gravity)
Config.BaseFlightTime = 1.9 -- seconds for a launch at speed multiplier 1
Config.MinFlightTime = 0.75
Config.SpeedPerHit = 0.06 -- speed multiplier gained per hit
Config.MaxSpeedMultiplier = 2.4
Config.PopUpHeight = 14 -- juggle pop-up apex above the hit point
Config.PopUpTime = 1.1
Config.ApexHeightBase = 22 -- launch arc height
Config.BallRadius = 1.4
Config.MaxConsecutiveTouches = 2
Config.ServeHeight = 40

-- Hits (server validation) ----------------------------------------------------
Config.ReachJuggle = 9
Config.ReachVolley = 10
Config.ReachDive = 14 -- expanded hitbox for saves
Config.ReachBotBonus = 0
Config.HitCooldown = 0.28
Config.DiveCooldown = 1.6
Config.LatencyGrace = 0.25 -- seconds of rewind allowed when validating distance

-- Abilities -------------------------------------------------------------------
Config.AbilityCooldown = 18
Config.MagCleatsRange = 28
Config.TimeTrapDuration = 1.2
Config.MeteorRange = 34
Config.KnuckleCurve = 38 -- lateral acceleration studs/s^2

-- Economy -----------------------------------------------------------------------
Config.CoinsPerElimination = 10
Config.CoinsPerWin = 50
Config.CoinsPerMatch = 5
Config.SpinCost = 150
Config.SpinWeights = { Common = 55, Rare = 28, Epic = 13, Legendary = 4 }
Config.DuplicateRefund = { Common = 40, Rare = 80, Epic = 150, Legendary = 300 }

-- Game passes (cosmetic only). Set the ids once the passes exist in the group.
Config.GamePasses = {
	VIP = 0, -- chat tag + cosmetic trail
	DoubleCoins = 0,
	ExtraSkinSlots = 0,
}

-- Redeem codes (server only reads this table).
Config.Codes = {
	BOOM = 200,
	HEADERBOMB = 300,
	DEALTDAMAGE = 500,
}

-- Leaderboards --------------------------------------------------------------------
Config.LeaderboardRefresh = 60
Config.LeaderboardSize = 50

-- Bots ------------------------------------------------------------------------------
Config.BotReactionMin = 0.18
Config.BotReactionMax = 0.42
Config.BotMissChance = 0.12
Config.BotWalkSpeed = 22
Config.FallbackBotNames = {
	"StrikerNova", "VolleyViper", "KickKaiser", "BlazeBoot", "NeonNutmeg",
	"HeaderHawk", "FuseFury", "TurfTitan", "BicycleBandit", "GoalGhost",
}

-- Practice zone ------------------------------------------------------------------------
Config.PracticeGravity = 40

return Config
