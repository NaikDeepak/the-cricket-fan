def test_list_teams_returns_seeded_teams(client):
    res = client.get("/teams")
    assert res.status_code == 200
    teams = res.json()
    assert len(teams) >= 20
    names = [t["name"] for t in teams]
    assert "Chennai Super Kings" in names
    assert "Lyca Kovai Kings" in names
    assert "Puneri Bappa" in names
    assert "Trinbago Knight Riders" in names


def test_filter_teams_by_league(client):
    res = client.get("/teams?league=TNPL")
    assert res.status_code == 200
    teams = res.json()
    assert len(teams) >= 8
    for t in teams:
        assert t["league"] == "TNPL"


def test_search_teams(client):
    res = client.get("/teams?search=kovai")
    assert res.status_code == 200
    teams = res.json()
    assert len(teams) == 1
    assert teams[0]["short_name"] == "LKK"


def test_create_and_update_team(client):
    # 1. Create custom team
    new_team = {
        "name": "Coimbatore Comets",
        "short_name": "CC",
        "league": "TNPL",
        "primary_color": "#00FFCC",
        "secondary_color": "#003366",
        "accent_color": "#00FFCC",
        "aliases": ["comets", "coimbatore"],
    }
    res = client.post("/teams", json=new_team)
    assert res.status_code == 201
    created = res.json()
    tid = created["id"]
    assert created["name"] == "Coimbatore Comets"
    assert created["theme"]["primary"] == "#00FFCC"

    # 2. Patch team colors
    patch_res = client.patch(
        f"/teams/{tid}",
        json={"primary_color": "#00EEBB", "accent_color": "#00EEBB"},
    )
    assert patch_res.status_code == 200
    patched = patch_res.json()
    assert patched["primary_color"] == "#00EEBB"
    assert patched["theme"]["primary"] == "#00EEBB"

    # 3. Delete team
    del_res = client.delete(f"/teams/{tid}")
    assert del_res.status_code == 204

    # 4. Get after delete is 404
    get_res = client.get(f"/teams/{tid}")
    assert get_res.status_code == 404
