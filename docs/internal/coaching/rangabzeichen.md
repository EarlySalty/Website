# Rangabzeichen im Coaching

Stand: 03.10.2026, Deadlock-Clientversion 6739.

Die Coaching-Auswahl verwendet die Rangnamen und unveränderten WebP-Spielgrafiken aus der [Rang-API](https://api.deadlock-api.com/v1/assets/ranks?client_version=6739). Die [Versionsliste](https://api.deadlock-api.com/v1/assets/client-versions) führte 6739 beim Abruf als neueste Version. Der [API-Quellcode](https://github.com/deadlock-api/deadlock-api/blob/master/api/src/services/assets/versions/ranks.rs) leitet die Rangnamen aus den Spielübersetzungen ab und verweist auf die extrahierten Spielgrafiken.

| Tier | Aktueller Rang |
| --- | --- |
| 1 | Initiate |
| 2 | Seeker |
| 3 | Acolyte |
| 4 | Sentinel |
| 5 | Mystic |
| 6 | Ritualist |
| 7 | Emissary |
| 8 | Oracle |
| 9 | Phantom |
| 10 | Ascendant |
| 11 | Eternus |

Obscurus ist Tier 0 ohne Unterstufen. Im Formular bleibt dafür die bestehende Auswahl „Noch kein Rang“. Die früheren Namen Alchemist, Arcanist und Archon stehen nicht mehr in der aktuellen Liste. Ritualist und Emissary haben jetzt Tier 6 und 7.

`public/ranks/6739/sources.json` enthält Herkunft und SHA-256 jedes unverändert gespeicherten Abzeichens. Die versionierten lokalen Pfade vermeiden eine CDN-Abhängigkeit beim Ausfüllen. `src/lib/coachingRequest.ts` führt die zentrale Rangliste und Bildzuordnung. Der Rust-Handler in `builds/backend-rust/src/routes/coaching.rs` übernimmt Rang und Stufe als Text, sodass die aktuellen Namen ohne Backendänderung gespeichert werden. Frühere Anfragen behalten ihre historischen Rangnamen.
