# Miami-Dade County park geography

These supplied GeoJSON files are included in this hackathon repository with
the project owner's approval. They are source geography only; they do not
assert that any colony or cat is present at a park.

## Source attribution

- Park boundaries: [Miami-Dade County Local Government GIS, Park Boundary
  layer 14](https://gisws.miamidade.gov/arcgis/rest/services/LocalGov/MD_LocalGovernment/MapServer/14)
- Park representative points: [Miami-Dade County Local Government GIS, Park
  layer 9](https://gisws.miamidade.gov/arcgis/rest/services/LocalGov/MD_LocalGovernment/MapServer/9)
- County Open Data Hub [Terms of Use and disclaimer](https://opendata.miamidade.gov/pages/terms-of-use)

The files retain their source metadata and feature attributes. The app uses a
separate, fixed mapping from the 18 stable synthetic colony IDs to selected
park features. Those map markers are fictional demonstration locations only.
The mapping does not modify colony, cat, census, history, or membership
records.

## County disclaimer

> Miami-Dade County provides this data for use "as is". The areas depicted by
> this map/data are approximate, and are not accurate to surveying or
> engineering standards. The maps/data shown here are for illustration
> purposes only and are not suitable for site-specific decision making.
> Information found here should not be used for making financial or any other
> commitments. Miami-Dade County provides this information with the
> understanding that it is not guaranteed to be accurate, correct or complete
> and conclusions drawn from such information are the sole responsibility of
> the user. While every effort has been made to ensure the accuracy,
> correctness and timeliness of materials presented, Miami-Dade County
> assumes no responsibility for errors or omissions, even if Miami-Dade
> County is advised of the possibility of such damage.

## Basemap

The interactive map uses OpenStreetMap's standard raster tiles. The map keeps
the required visible `© OpenStreetMap contributors` attribution and links to
the [OpenStreetMap copyright and license page](https://www.openstreetmap.org/copyright).
Tile requests follow the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/);
tiles are requested only for the active viewport and use browser caching.
